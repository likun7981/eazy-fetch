(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.SimpleFetch = {})));
}(this, (function (exports) { 'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/**
 * @author: likun,
 * @description:
 *  This tool add some hook and global config;
 * @example:
 *  import { request, createRequest } from '@likun7981/easy-fetch';
 *  const requestHandle = request('GET http://www.xxx.com',{param:1}).success(()=>{}).error(()=>{})
 *  // You can cancel it
 *  requestHandle.abort();
 *  // You want to config
 *  const reqest = createRequest({ timeout: 3000 })
 *  const requestHandle = reqest('GET http://www.xxx.com',{param:1}).success(()=>{}).error(()=>{})
 *  // Global config attrs: body, timeout, headers
 */

require('isomorphic-fetch');
var stringify = require('qs/lib/stringify');

var noop = function noop() {};
var configs = {};
var globalKeys = ['body', 'timeout', 'headers', 'onSuccess', 'onComplete', 'successFilter', 'onError', 'onStart'];
var timeoutHandle = void 0;

var createRequest = function createRequest() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$headers = _ref.headers,
      headers = _ref$headers === undefined ? {} : _ref$headers,
      credentials = _ref.credentials,
      _ref$timeout = _ref.timeout,
      timeout = _ref$timeout === undefined ? 5000 : _ref$timeout,
      _ref$onStart = _ref.onStart,
      onStart = _ref$onStart === undefined ? configs.onStart || noop : _ref$onStart,
      _ref$onComplete = _ref.onComplete,
      onComplete = _ref$onComplete === undefined ? configs.onComplete || noop : _ref$onComplete,
      _ref$onSuccess = _ref.onSuccess,
      onSuccess = _ref$onSuccess === undefined ? configs.onSuccess || noop : _ref$onSuccess,
      _ref$onError = _ref.onError,
      onError = _ref$onError === undefined ? configs.onError || noop : _ref$onError,
      _ref$successFilter = _ref.successFilter,
      successFilter = _ref$successFilter === undefined ? configs.successFilter || function (response) {
    return Promise.resolve(response);
  } : _ref$successFilter;

  timeout = typeof timeout !== 'undefined' ? timeout : configs.timeout;
  var assignHeaders = configs.headers ? _extends({}, configs.headers, headers) : headers;
  var options = _extends({}, configs, {
    headers: assignHeaders
  });
  if (credentials) {
    options.credentials = credentials;
  }
  return function (urlWithMethod) {
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var _ref2 = urlWithMethod.indexOf(' ') > 0 ? urlWithMethod.split(/\s+/) : ['GET', urlWithMethod],
        method = _ref2[0],
        url = _ref2[1];

    var assignBody = configs.body ? _extends({}, configs.body, params) : params;
    if (method !== 'GET') {
      options.method = method;
    }
    assignBody = JSON.parse(JSON.stringify(assignBody));
    if (Object.keys(assignBody).length) {
      if (method.toUpperCase() !== 'GET') {
        options.body = JSON.stringify(assignBody);
      } else {
        url += '?' + stringify(assignBody);
      }
    }
    var abortable = void 0;
    var promise = new Promise(function (resolve, reject) {
      onStart();
      abortable = abortablePromise(fetch(url, options));
      abortable.then(function (response) {
        clearTimeout(timeoutHandle);
        if (response.ok) {
          var _headers = response.headers;
          successFilter(response).then(function (result) {
            onSuccess(result);
            onComplete(null, result);
            resolve({ result: result, headers: _headers });
          }, function (error) {
            onError(error);
            onComplete(error);
            reject(error);
          })['catch'](reject);
        } else {
          var error = new Error(response.statusText);
          onError(error);
          onComplete(error);
          reject(error);
        }
      }, function (error) {
        clearTimeout(timeoutHandle);
        if (!(error && error.isAbort)) {
          onError(error);
          onComplete(error);
        }
        reject(error);
      })['catch'](reject);
    });
    var requestPromise = {};

    requestPromise.success = function (fn) {
      fn = typeof fn === 'function' ? fn : noop;
      promise.then(function (_ref3) {
        var result = _ref3.result,
            headers = _ref3.headers;

        fn(result, headers);
      }, noop);
      return requestPromise;
    };
    requestPromise.error = function (fn) {
      fn = typeof fn === 'function' ? fn : noop;
      promise.then(null, function (error) {
        if (!(error && error.isAbort)) fn(error);
      });
      return requestPromise;
    };
    requestPromise.complete = function (fn) {
      fn = typeof fn === 'function' ? fn : noop;
      promise.then(function () {
        var allOfIt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        var result = allOfIt.result;

        fn(null, result);
      }, function (error) {
        if (!(error && error.isAbort)) fn(error);
      });
      return requestPromise;
    };
    requestPromise.abort = abortable.abort;
    requestPromise['catch'] = promise['catch'];
    if (typeof timeout !== 'undefined') {
      timeoutHandle = setTimeout(function () {
        requestPromise.abort('fetch timeout');
      }, timeout);
    }
    return requestPromise;
  };
};

var globalConfig = function globalConfig() {
  var gconfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  globalKeys.forEach(function (key) {
    configs[key] = gconfig[key];
  });
};

function abortablePromise(fetchPromise) {
  var abortFn = null;
  var abortPromise = new Promise(function (resolve, reject) {
    abortFn = function abortFn(message) {
      var cancelError = new Error(message || 'fetch canceled');
      if (!message) {
        // isAbort
        cancelError.isAbort = true;
        console.warn(cancelError.message);
        clearTimeout(timeoutHandle);
      } else {
        cancelError.isTimeout = true;
      }
      reject(cancelError);
    };
  });
  var abortablePromise = Promise.race([fetchPromise, abortPromise]);
  abortablePromise.abort = function (message) {
    var fn = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : noop;

    if (typeof message === 'function') {
      fn = message;
      message = null;
    }
    fn();
    abortFn(message);
  };
  return abortablePromise;
}

exports.createRequest = createRequest;
exports.globalConfig = globalConfig;

Object.defineProperty(exports, '__esModule', { value: true });

})));
