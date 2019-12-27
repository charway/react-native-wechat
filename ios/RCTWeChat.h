//
//  RCTWeChat.h
//  RCTWeChat
//
//  Created by Yorkie Liu on 10/16/15.
//  Copyright © 2015 WeFlex. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import "WXApi.h"

#define RCTWXEventName @"WeChat_Resp"

// define share type constants
#define RCTWXSendMessageEvent @"SendMessageToWX.Resp"
#define RCTWXSendAuthEvent @"SendAuth.Resp"
#define RCTWXLaunchMiniProgramEvent @"LaunchMiniProgram.Resp"
#define RCTWXPayEvent @"PayReq.Resp"

@interface RCTWeChat : RCTEventEmitter<RCTBridgeModule, WXApiDelegate>

@property NSString* appId;

@end
