/*global angular*/
var app = angular.module("readiot", ['dropbox']);

app.factory('Setup', function(Dropbox, $http){
    var setup = {};
    setup.put = function(source, token){
        var content = $http.get(source);
        var name_pos = source.lastIndexOf("/") + 1;
        var filename = source.substr(name_pos);
        var destination = "static/" + filename;
        return Dropbox.writeFile(destination,
                                 content,
                                 undefined,
                                 token);
    };
    return setup;
});

function SetupCtrl($scope, $http, Dropbox, Setup){
    $scope.getCode = function() {
        var key = $scope.key;
        $scope.code_link = Dropbox.getCodeUrl(key);
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
               "params": data}).then(function(response){
            $scope.token = response.data.access_token;
            $scope.uid = response.data.uid;
            $scope.updateFiles();
        });
    };
    $scope.updateFiles = function() {
        Setup.put('style.css', $scope.token);
    };
}
