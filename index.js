'use strict';

import { DeviceEventEmitter, NativeModules, Platform, NativeEventEmitter } from 'react-native';
import { EventEmitter } from 'events';

let isAppRegistered = false;
const { WeChat } = NativeModules;

// Event emitter to dispatch request and response from WeChat.
const emitter = new EventEmitter();

const WXScene = {
  Session           : 0,  /** 聊天界面 */
  Timeline          : 1,  /** 朋友圈 */
  Favorite          : 2,  /** 收藏 */
  SpecifiedSession  : 3,  /** 指定联系人(Not Supported) */
};

DeviceEventEmitter.addListener('WeChat_Resp', resp => {
  emitter.emit(resp.type, resp);
});


const wechatManagerEmitter = new NativeEventEmitter(WeChat);


const subscription = wechatManagerEmitter.addListener('WeChat_Resp', resp => {
  emitter.emit(resp.type, resp);
});

function wrapRegisterApp(nativeFunc) {
  if (!nativeFunc) {
    return undefined;
  }
  return (...args) => {
    if (isAppRegistered) {
      // FIXME(Yorkie): we ignore this error if AppRegistered is true.
      return Promise.resolve(true);
    }
    isAppRegistered = true;
    return new Promise((resolve, reject) => {
      nativeFunc.apply(null, [
        ...args,
        (error, result) => {
          if (!error) {
            return resolve(result);
          }
          if (typeof error === 'string') {
            return reject(new Error(error));
          }
          reject(error);
        },
      ]);
    });
  };
}

function wrapApi(nativeFunc) {
  if (!nativeFunc) {
    return undefined;
  }
  return (...args) => {
    if (!isAppRegistered) {
      return Promise.reject(new Error('registerApp required.'));
    }
    return new Promise((resolve, reject) => {
      nativeFunc.apply(null, [
        ...args,
        (error, result) => {
          if (!error) {
            return resolve(result);
          }
          if (typeof error === 'string') {
            return reject(new Error(error));
          }
          reject(error);
        },
      ]);
    });
  };
}

function sendRequestAndWaitResp(fn, respType) {
  return new Promise((resolve, reject) => {
    try {
      let r = fn();
      if (r instanceof Promise) {
        r.catch(reject);
      }
    } catch (err) {
      reject(err);
    }
    emitter.once(respType, resp => {
      if (resp.errCode === 0) {
        resolve(resp);
      } else {
        reject(new WechatError(resp));
      }
    });
  });
}

/**
 * `addListener` inherits from `events` module
 * @method addListener
 * @param {String} eventName - the event name
 * @param {Function} trigger - the function when event is fired
 */
export const addListener = emitter.addListener.bind(emitter);

/**
 * `once` inherits from `events` module
 * @method once
 * @param {String} eventName - the event name
 * @param {Function} trigger - the function when event is fired
 */
export const once = emitter.once.bind(emitter);

/**
 * `removeAllListeners` inherits from `events` module
 * @method removeAllListeners
 * @param {String} eventName - the event name
 */
export const removeAllListeners = emitter.removeAllListeners.bind(emitter);

/**
 * @method registerApp
 * @param {String} appid - the app id
 * @return {Promise}
 */
export const registerApp = wrapRegisterApp(WeChat.registerApp);

/**
 * @method registerAppWithDescription
 * @param {String} appid - the app id
 * @param {String} appdesc - the app description
 * @return {Promise}
 */
export const registerAppWithDescription = wrapRegisterApp(
  WeChat.registerAppWithDescription,
);

/**
 * Return if the wechat app is installed in the device.
 * @method isWXAppInstalled
 * @return {Promise}
 */
export const isWXAppInstalled = wrapApi(WeChat.isWXAppInstalled);

/**
 * Return if the wechat application supports the api
 * @method isWXAppSupportApi
 * @return {Promise}
 */
export const isWXAppSupportApi = wrapApi(WeChat.isWXAppSupportApi);

/**
 * Get the wechat app installed url
 * @method getWXAppInstallUrl
 * @return {String} the wechat app installed url
 */
export const getWXAppInstallUrl = wrapApi(WeChat.getWXAppInstallUrl);

/**
 * Get the wechat api version
 * @method getApiVersion
 * @return {String} the api version string
 */
export const getApiVersion = wrapApi(WeChat.getApiVersion);

/**
 * Open wechat app
 * @method openWXApp
 * @return {Promise}
 */
export const openWXApp = wrapApi(WeChat.openWXApp);

// wrap the APIs
const nativeShareToTimeline = wrapApi(WeChat.shareToTimeline);
const nativeShareToSession = wrapApi(WeChat.shareToSession);
const nativeShareToFavorite = wrapApi(WeChat.shareToFavorite);
const nativeSendAuthRequest = wrapApi(WeChat.sendAuthRequest);
const nativeOpenMiniProgram = wrapApi(WeChat.openMiniProgram)
const nativeShareImage = wrapApi(WeChat.shareImage);
const nativeShareWebpage = wrapApi(WeChat.shareWebpage);
const nativeShareMiniProgram = wrapApi(WeChat.shareMiniProgram);


/**
 * @method sendAuthRequest
 * @param {Array} scopes - the scopes for authentication.
 * @return {Promise}
 */
export function sendAuthRequest(scopes, state) {
  return sendRequestAndWaitResp(() => nativeSendAuthRequest(scopes, state) , 'SendAuth.Resp');
}


/**
 * Open a mini program
 * @method openMiniProgram
 * @return {Promise}
 */
export function openMiniProgram({id, type, path}) {
  return sendRequestAndWaitResp(() => nativeOpenMiniProgram({ id, type, path }), 'LaunchMiniProgram.Resp');
}

// the internal share implmentation
function shareTo(scene, data) {
  if (data.type === 'imageUrl' ||
    data.type === 'imageResource' ||
    data.type === 'imageFile') {
    return nativeShareImage({
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      scene,
    });
  } else if (data.type === 'news') {
    return nativeShareWebpage({
      title: data.title,
      description: data.description,
      thumbImageUrl: data.thumbImageUrl,
      webpageUrl: data.webpageUrl,
      scene,
    });
  } else if (data.type === 'miniprogram') {
    const miniProgram = data.miniProgram;
    return nativeShareMiniProgram({
      title: data.title,
      description: data.description,
      thumbImageUrl: data.thumbImageUrl,
      // backwards to the old version in web page.
      webpageUrl: data.webpageUrl,
      // the mini program id
      miniProgramId: miniProgram.id,
      // 0:release, 1:test, 2:debug/experimental
      miniProgramType: miniProgram.type,
      // the page path, for example: `?foo=bar`
      miniProgramPath: miniProgram.path,
      scene,
    });
  }
}

/**
 * Share something to timeline/moments/朋友圈
 * @method shareToTimeline
 * @param {Object} data
 * @param {String} data.thumbImage - Thumb image of the message, which can be a uri or a resource id.
 * @param {String} data.type - Type of this message. Could be {news|text|imageUrl|imageFile|imageResource|video|audio|file}
 * @param {String} data.webpageUrl - Required if type equals news. The webpage link to share.
 * @param {String} data.imageUrl - Provide a remote image if type equals image.
 * @param {String} data.videoUrl - Provide a remote video if type equals video.
 * @param {String} data.musicUrl - Provide a remote music if type equals audio.
 * @param {String} data.filePath - Provide a local file if type equals file.
 * @param {String} data.fileExtension - Provide the file type if type equals file.
 */
export function shareToTimeline(data) {
  return sendRequestAndWaitResp(() => shareTo(WXScene.Timeline, data), 'SendMessageToWX.Resp');
}

/**
 * Share something to a friend or group
 * @method shareToSession
 * @param {Object} data
 * @param {String} data.thumbImage - Thumb image of the message, which can be a uri or a resource id.
 * @param {String} data.type - Type of this message. Could be {news|text|imageUrl|imageFile|imageResource|video|audio|file}
 * @param {String} data.webpageUrl - Required if type equals news. The webpage link to share.
 * @param {String} data.imageUrl - Provide a remote image if type equals image.
 * @param {String} data.videoUrl - Provide a remote video if type equals video.
 * @param {String} data.musicUrl - Provide a remote music if type equals audio.
 * @param {String} data.filePath - Provide a local file if type equals file.
 * @param {String} data.fileExtension - Provide the file type if type equals file.
 */
export function shareToSession(data) {
  return sendRequestAndWaitResp(() => shareTo(WXScene.Session, data), 'SendMessageToWX.Resp');
}

/**
 * Share something to favorite
 * @method shareToFavorite
 * @param {Object} data
 * @param {String} data.thumbImage - Thumb image of the message, which can be a uri or a resource id.
 * @param {String} data.type - Type of this message. Could be {news|text|imageUrl|imageFile|imageResource|video|audio|file}
 * @param {String} data.webpageUrl - Required if type equals news. The webpage link to share.
 * @param {String} data.imageUrl - Provide a remote image if type equals image.
 * @param {String} data.videoUrl - Provide a remote video if type equals video.
 * @param {String} data.musicUrl - Provide a remote music if type equals audio.
 * @param {String} data.filePath - Provide a local file if type equals file.
 * @param {String} data.fileExtension - Provide the file type if type equals file.
 */
export function shareToFavorite(data) {
  return sendRequestAndWaitResp(() => shareTo(WXScene.Favorite, data), 'SendMessageToWX.Resp');
}

/**
 * wechat pay
 * @param {Object} data
 * @param {String} data.partnerId
 * @param {String} data.prepayId
 * @param {String} data.nonceStr
 * @param {String} data.timeStamp
 * @param {String} data.package
 * @param {String} data.sign
 * @returns {Promise}
 */
export function pay(data) {
  // FIXME(Yorkie): see https://github.com/yorkie/react-native-wechat/issues/203
  // Here the server-side returns params in lowercase, but here SDK requires timeStamp
  // for compatibility, we make this correction for users.
  function correct(actual, fixed) {
    if (!data[fixed] && data[actual]) {
      data[fixed] = data[actual];
      delete data[actual];
    }
  }
  correct('prepayid', 'prepayId');
  correct('noncestr', 'nonceStr');
  correct('partnerid', 'partnerId');
  correct('timestamp', 'timeStamp');
  
  // FIXME(94cstyles)
  // Android requires the type of the timeStamp field to be a string
  if (Platform.OS === 'android') data.timeStamp = String(data.timeStamp)

  return new Promise((resolve, reject) => {
    WeChat.pay(data, result => {
      if (result) reject(result);
    });
    emitter.once('PayReq.Resp', resp => {
      if (resp.errCode === 0) {
        resolve(resp);
      } else {
        reject(new WechatError(resp));
      }
    });
  });
}

/**
 * promises will reject with this error when API call finish with an errCode other than zero.
 */
export class WechatError extends Error {
  constructor(resp) {
    const message = resp.errStr || resp.errCode.toString();
    super(message);
    this.name = 'WechatError';
    this.code = resp.errCode;

    // avoid babel's limition about extending Error class
    // https://github.com/babel/babel/issues/3083
    if (typeof Object.setPrototypeOf === 'function') {
      Object.setPrototypeOf(this, WechatError.prototype);
    } else {
      this.__proto__ = WechatError.prototype;
    }
  }
}

