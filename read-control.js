/*global angular, document*/
var app = angular.module("readiot", []);

app.directive('url', function(){
    return {
        'restrict': 'A',
        link: function(scope, element, attrs){
            scope.data.url = attrs.href;
        }
    };
});

app.directive('title', function(){
    return {
        'restrict': 'A',
        link: function(scope, element){
            scope.data.title = element.text();
        }
    };
});


app.directive('story', function(){
    return {
        'restrict': 'A',
        link: function(scope, element){
            scope.data.story = element.text();
        }
    };
});

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

      // Data stores.
      getStore:           apiServer   + '/1/datastores/get_datastore',
      addRecord:          apiServer   + '/1/datastores/put_delta',
      getRecords:         apiServer   + '/1/datastores/get_snapshot'
    };

    var api = {};
    api.authRequest = function(config, use_ds){
        var token = '[{ TOKEN }]';
        var handle = '[{ HANDLE }]';
        if (!config.headers) { config.headers = {}; }
        if (use_ds) {
            if(config.method === "GET"){
                config.params.handle = handle;
            } else {
                config.data.handle = handle;
            }
        }
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
    api.getRevision = function(){
        var config = {method: "GET",
                      url: urls.getStore,
                      params: {dsid: "default"}};
        return api.authRequest(config);
    };
    api.getRecords = function(){
        var config = {method: "GET",
                      url: urls.getRecords,
                      params: {}};
        return api.authRequest(config, true);
    };
    api.addRecord = function(data){
        var promise = api.getRevision();
        promise.then(function(response){
            var rev = response.rev;
            var record_id = new Date().getTime();
            record_id = "t" + record_id.toString();
            var change = [["I", "log", record_id, data]];
            var delta = {changes: JSON.stringify(change),
                        rev: rev};
            var config = {method: "POST",
                        url: urls.addRecord,
                        data: delta,
                        params: delta};
            return api.authRequest(config, true);
        });
        return promise;
    };
    return api;
});



app.factory('db', function($window, DropAPI){
    var article = {};
    var remove_js = function(content){
        return content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    };
    article.save = function(title) {
        var content = $window.document.documentElement.outerHTML;
        content = remove_js(content);
        var name = title + ".html";
        return DropAPI.saveContent(name, content);
    };
    return article;
});


function ReadCtrl($scope, $timeout, $window, db, DropAPI){
    // update stats if stayed on article for 8 secs
    $scope.data = {};
    $timeout(function(){
        var record = {
            title: $scope.data.title,
            time: new Date().toString(),
            words: $scope.data.story.split(' ').length,
            url: $scope.data.url
        };
        DropAPI.addRecord(record);
    }, 8000);

    // Save button and actions
    $scope.save_status = "Save";
    $scope.save = function(){
        $scope.save_status = "Saving...";
        db.save($scope.data.title);
        // db.save($scope.title, true)
          // .success(function(){ $scope.text = "Saved"; });
    };

    // Highlight button and actions
    $scope.has_selection = false;
    $scope.range = false;  // this is the selection range obj
    $scope.highlight_selected = function(){
        var span = $window.document.createElement("mark");
        var sel = $window.getSelection();
        $scope.range.surroundContents(span);
        sel.removeAllRanges();
        $scope.has_selection = false;
        $scope.range = false;
        db.save($scope.data.title);
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
