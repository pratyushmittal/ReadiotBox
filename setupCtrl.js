/*global angular*/
var app = angular.module("readiot", []);

app.factory('DropAPI', function($http, $q){
    // API Servers
    var apiServer  = 'https://api.dropbox.com'
      , fileServer = 'https://api-content.dropbox.com';
    var urls = {
      // Accounts.
      accountInfo:         apiServer  + '/1/account/info',

      // Files and metadata.
      getFile:             fileServer + '/1/files/auto/',
      postFile:            fileServer + '/1/files/auto/',
      putFile:             fileServer + '/1/files_put/auto/',
      search:              apiServer  + '/1/search/auto/',
      shares:              apiServer  + '/1/shares/auto/',
      media:               apiServer  + '/1/media/auto/',
    };

    var api = {};
    api.authRequest = function(config, token){
        if (!config.headers) { config.headers = {}; }
        config.headers.Authorization = 'Bearer ' + token;
        config.cache = false;
        var deferred = $q.defer();
        function success(response) {
            console.log(config, response.data);
            deferred.resolve(response.data);
        }

        function failure(fault) {
            console.log(config, fault);
            deferred.reject(fault);
        }

        $http(config).then(success, failure);
        return deferred.promise;
    };
    api.getContent = function(path, token, params){
        var config = {method: "GET",
                      url: urls.getFile + path,
                      params: params};
        return api.authRequest(config, token);
    };
    api.saveContent = function(path, content, token, params){
        var config = {method: "POST",
                      url: urls.putFile + path,
                      data: content,
                      headers: { 'Content-Type': undefined },
                      transformRequest: angular.identity,
                      params: params};
        return api.authRequest(config, token);
    };
    api.getLink = function(path, token, params){
        var config = {method: "POST",
                      url: urls.media + path,
                      params: params};
        return api.authRequest(config, token);
    };
    return api;
});

app.factory('Setup', function(DropAPI, $http){
    var setup = {};
    setup.copy = function(source, token, context){
        var getLink = function(destination){
            return DropAPI.getLink(destination, token)
                          .then(function(response){
                              return response.url;
                          });
        };
        var parseContent = function(template){
            var parsed = template;
            var key, value, syntax;
            for (key in context){
                if (context.hasOwnProperty(key)){
                    value = context[key];
                    syntax = "[{ " + key + " }]";
                    parsed = parsed.replace(syntax, value);
                }
            }
            return parsed;
        };
        var saveContent = function (response) {
            var content = parseContent(response.data);
            var name_pos = source.lastIndexOf("/") + 1;
            var filename = source.substr(name_pos);
            var destination = "static/" + filename;
            return DropAPI.saveContent(destination, content, token)
                   .then(function(){
                       return getLink(destination);
                   });
        };
        return $http.get(source, {cache: false})
                    .then(saveContent);
    };
    return setup;
});

function SetupCtrl($scope, $http, $window, Setup){
    $scope.getCode = function() {
        var key = $scope.key;
        var domain = 'https://www.dropbox.com';
        var url = domain + '/1/oauth2/authorize';
        var codeUrl = url
                    + '?client_id=' + key
                    + '&response_type=code';
        $scope.code_link = codeUrl;
    };
    $scope.getToken = function() {
        var key = $scope.key;
        var secret = $scope.secret;
        var code = $scope.code;
        var url = "https://api.dropbox.com/1/oauth2/token";
        var data = {"client_id": key,
                    "client_secret": secret,
                    "code": code,
                    "grant_type": "authorization_code"};
        $http({"method": "POST",
               "url": url,
               "data": data,
               "cache": false,
               "params": data}).then(function(response){
            $scope.token = response.data.access_token;
            $scope.uid = response.data.uid;
            $scope.updateFiles();
        });
    };


    var someError = function(){
        $scope.message = "Some error occurred";
    };
    var copyIndex = function(context){
        var promise = Setup.copy('index.html',
            $scope.token, context);
        return promise.then(function(url){
            $window.location.assign(url);
        }, someError);
    };
    var copyParser = function(context){
        var promise = Setup.copy('parser.js', $scope.token, context);
        return promise.then(function(url){
            context.PARSER = url;
            return copyIndex(context);
        }, someError);
    };
    var copyCtrl = function(context){
        var promise = Setup.copy('read-control.js', $scope.token, context);
        return promise.then(function(url){
            context.READJS = url;
            return copyParser(context);
        }, someError);
    };
    var copyCss = function(context){
        var promise = Setup.copy('style.css', $scope.token, context);
        return promise.then(function(url){
            console.log("Url is");
            console.log(url);
            context.STYLE = url;
            return copyCtrl(context);
        }, someError);
    };
    $scope.updateFiles = function() {
        $scope.message = "Setting up...";
        var context = {TOKEN: $scope.token};
        copyCss(context);
    };
}
