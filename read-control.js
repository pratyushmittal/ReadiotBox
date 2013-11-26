var app = angular.module("readiot", ['dropbox']);

app.factory('db', function($window, $http){
    var article = {};
    article.save = function(title, overwrite){
        overwrite = overwrite || false;
        var postData = {
            "html": $window.document.documentElement.outerHTML,
            "title": title,
            "overwrite": overwrite
        };
        var url = "/save";
        return $http({"url": url, "method": "POST", "data": postData});
    };
    return article;
});


function ReadCtrl($scope, $window, Dropbox, db){
    // Save button and actions
    $scope.save_status = "Save";
    $scope.save = function(){
        $scope.save_status = "Saving...";
        Dropbox.writeFile("test.txt", "bro");
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


angular.bootstrap(document, ['readiot']);
