/*global angular, document*/
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
    api.authRequest = function(config){
        var token = '[{ TOKEN }]';
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
    api.getContent = function(path, params){
        var config = {method: "GET",
                      url: urls.getFile + path,
                      params: params};
        return api.authRequest(config);
    };
    api.saveContent = function(path, content, params){
        var config = {method: "POST",
                      url: urls.putFile + path,
                      data: content,
                      headers: { 'Content-Type': undefined },
                      transformRequest: angular.identity,
                      params: params};
        return api.authRequest(config);
    };
    api.getLink = function(path, params){
        var config = {method: "POST",
                      url: urls.media + path,
                      params: params};
        return api.authRequest(config);
    };
    return api;
});



app.factory('db', function($window, $http, DropAPI){
    var article = {};
    article.update_stats = function(url, heading, words){
        var articles = DropAPI.saveContent(name, content);
        var time = now();
        var stat = {url: url,
                    heading: heading,
                    words: words,
                    time: time};
        articles.push = stat;
        return DropAPI.saveContent("stats.json", content)
    };
    article.save = function(title) {
        var content = $window.document.documentElement.outerHTML;
        var name = title + ".json";
        return DropAPI.saveContent(name, content);
    };
    return article;
});


function ReadCtrl($scope, $window, db){
    db.update_stats(url, title, content);

    // Save button and actions
    $scope.save_status = "Save";
    $scope.save = function(){
        $scope.save_status = "Saving...";
        db.save($scope.title);
        // db.save($scope.title, true)
          // .success(function(){ $scope.text = "Saved"; });
    };

    // Highlight button and actions
    $scope.has_selection = false;
    $scope.range = false;  // this is the selection range obj
    $scope.highlight_selected = function(){
        var span = $window.document.createElement("mark");
        var sel = $window.getSelection();
        try{
            $scope.range.surroundContents(span);
        } catch(err){}
        sel.removeAllRanges();
        $scope.has_selection = false;
        $scope.range = false;
        db.save($scope.title, true);
    };

    // Check selection on mouseup on story
    $scope.check_selection = function(){
        $scope.has_selection = false;
        if ($window.getSelection) {
            var sel = $window.getSelection();
            if (sel.rangeCount > 0 && sel.toString().length > 0) {
                $scope.range = sel.getRangeAt(0).cloneRange();
                $scope.has_selection = true;
            }
        }
    };
}


/* Home Controls */

app.factory('utils', function() {
    return {
        "in_period": function(articles, days) {
            var filtered_list = [];
            var i, article_date;
            var cutoff = new Date().getTime() - days*24*60*60*1000;
            for (i = 0; i < articles.length; i++) {
                article_date = new Date(articles[i].time).getTime();
                if (article_date > cutoff) {
                    filtered_list.push(articles[i]);
                }
            }
            return filtered_list;
        },
        "get_page_count": function(articles) {
            var page_count = 0;
            var word_per_page = 200;
            var i;
            for (i = 0; i < articles.length;i++) {
                page_count += articles[i].words / word_per_page;
            }
            return Math.round(page_count);
        }
    };
});

function HomeCtrl($scope, $http, utils) {
    // Get DB
    $scope.articles = [];
    $http({"url": "/get_db", "method": "GET"}).success(
        function(data) {
            $scope.articles = data;
            // stats
            var today = utils.in_period($scope.articles, 1);
            var week = utils.in_period($scope.articles, 7);
            $scope.today_count = utils.get_page_count(today);
            $scope.week_count = utils.get_page_count(week);
            $scope.total_count = utils.get_page_count($scope.articles);
        });
    $scope.has_articles = function() {
        return $scope.articles.length > 0 ? true : false;
    };

    // Archives
    $scope.archives = [];
    $scope.get_archives = function(days){
        $scope.archives = utils.in_period($scope.articles, days);
    };
    $scope.has_archives = function() {
        return $scope.archives.length > 0 ? true : false;
    };
}


angular.bootstrap(document, ['readiot']);
