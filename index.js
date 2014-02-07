var etpl = require('etpl');
var caches = {};
var fs = require('fs');
var async = require('async');
var Q = require('q');
var _ = require('underscore');
var PATH = require('path');

function readFile(path) {
    var defer = Q.defer();
    async.waterfall([
        function(cb){
            fs.stat(path, function (err, stats) {

                if (err) {
                    cb(err);
                    return;
                }

                if (!stats.isFile()) {
                    cb('etpl need a file');
                    return;
                }

                cb();
            });
        },
        function(cb){
            fs.readFile(path, {
                encoding: 'utf8'
            }, function (err, file) {
                if (err) {
                    cb(err);
                    return;
                }
                cb(null, file);
            });
        }], 
        function (err, file) {
            if (err) {
                defer.reject(err);
                return;
            }
            defer.resolve(file);
        }
    );

    return defer.promise;
}

/**
 * 编译模板
 * 
 * @return {[type]} [return description]
 */
function compile(tasks) {

    var defer = Q.defer();

    async.mapSeries(tasks, function (task, cb) {
        readFile(task).then(function (file) {
            try {
                var render = etpl.compile(file);
                caches[task] = render;
                cb(null, render);
            } catch (e) {
                cb(e);
            }
        }, function (err) {
            cb(err);
        });
    }, function (err, result) {
        err ? defer.reject(err) : defer.resolve(result);
    });
    
    return defer.promise;
}

var defaults = {
    data: {},
    dep: []
};

/**
 * 编译模板
 * 
 * @param {string}          path            模板路径
 * @param {object}          options         编译参数
 * @param {array[string]}   options.dep     所依赖模板路径
 * @param {object|array}    options.data    模板数据:渲染模板所使用的数据
 * @param {function}        callback        回调函数
 */
module.exports = function (path, options, callback) {

    var cache = caches[path];

    options = _.extend({}, defaults, options);

    if (cache) {
        callback(null, cache(options.data));
        return;
    }

    var tasks = options.dep.map(function (dep) {
        return PATH.resolve(options.settings.views, dep + '.etpl');
    }).concat(path);

    compile(tasks).then(function (renders) {

        var len = tasks.length;
        var render = renders[len - 1];
        var result = render && render(options.data);

        callback(null, result);

    }, function (err) {
        callback(err);
    });
    
}