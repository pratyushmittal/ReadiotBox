/*global angular*/
var app = angular.module("readiot", []);

app.factory('DropAPI', function($http, $q){
    // API Servers
    var apiServer  = 'https://api.dropbox.com',
        fileServer = 'https://api-content.dropbox.com';
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

      // Data stores.
      createDb:            apiServer  + '/1/datastores/get_or_create_datastore',
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
        if (!params) { params = {short_url: false}; }
        var config = {method: "POST",
                      url: urls.shares + path,
                      params: params};
        return api.authRequest(config, token);
    };
    api.createDb = function(db_name, token){
        var config = {method: "POST",
                      url: urls.createDb,
                      data: {dsid: db_name},
                      params: {dsid: db_name}
                     };
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
                              var url = response.url;
                              url = url.replace(
                                  "www.dropbox",
                                  "dl.dropboxusercontent"
                              );
                              return url;
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
            return DropAPI.saveContent(source, content, token)
                   .then(function(){
                       return getLink(source);
                   });
        };
        return $http.get(source, {cache: false})
                    .then(saveContent);
    };
    return setup;
});

function SetupCtrl($scope, $http, $window, DropAPI, Setup){
    $scope.getCode = function() {
        var key = $scope.key;
        var domain = 'https://www.dropbox.com';
        var url = domain + '/1/oauth2/authorize';
        var codeUrl = url +
                      '?client_id=' + key +
                      '&response_type=code';
        $scope.code_link = codeUrl;
    };
    $scope.getToken = function() {
        $scope.message = "Setting up...";
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
    var copyParserAgain = function(context){
        var promise = Setup.copy('static/parser.js', $scope.token, context);
        return promise.then(function(){
            $window.location.assign(context.INDEX);
        }, someError);
    };
    var copyIndex = function(context){
        var promise = Setup.copy('static/index.html',
            $scope.token, context);
        return promise.then(function(url){
            context.INDEX = url;
            return copyParserAgain(context);
        }, someError);
    };
    var copyParser = function(context){
        var promise = Setup.copy('static/parser.js', $scope.token, context);
        return promise.then(function(url){
            context.PARSER = url;
            return copyIndex(context);
        }, someError);
    };
    var copyCtrl = function(context){
        var promise = Setup.copy('static/read-control.js', $scope.token, context);
        return promise.then(function(url){
            context.READJS = url;
            return copyParser(context);
        }, someError);
    };
    var copyCss = function(context){
        var promise = Setup.copy('static/style.css', $scope.token, context);
        return promise.then(function(url){
            context.STYLE = url;
            return copyCtrl(context);
        }, someError);
    };
    var createDb = function(context){
        var promise = DropAPI.createDb("default", $scope.token, context);
        return promise.then(function(response){
            context.HANDLE = response.handle;
            return copyCss(context);
        }, someError);
    };
    $scope.updateFiles = function() {
        $scope.message = "Setting up...";
        var context = {TOKEN: $scope.token};
        createDb(context);
    };
    $scope.updateApp = function() {
        $scope.message = "Finding token";
        var marklet = $scope.bookmarklet;
        var stop = marklet.indexOf("parser.js") + 9;
        var start = marklet.lastIndexOf("https", stop);
        var parser_path = marklet.substr(start, stop - start);
        var promise = $http.get(parser_path);
        promise.then(function(response){
            var reader = response.data;
            var j = reader.indexOf("read-control.js") + 15;
            var i = reader.lastIndexOf("https", j);
            var path = reader.substr(i, j - i);
            $http.get(path).then(function(resp){
                var data = resp.data;
                var k = data.indexOf("var token = '") + 13;
                var l = data.indexOf("'", k);
                var token = data.substr(k, l - k);
                $scope.token = token;
                $scope.updateFiles();
            }, someError);
        }, someError);
    };
}
