import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

import { Log } from "./lib/log";

export async function createAuthChallenge(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("CreateAuthChallenge Event", event);

    // tslint:disable-next-line:max-line-length
    if (event.request.session && event.request.session.length === 1 && event.request.session[0].challengeName === "CUSTOM_CHALLENGE") {
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
    } else {
        event.response.issueTokens = false;
        event.response.failAuthentication = true;
    }
    return event;
}

export async function defineAuthChallenge(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("DefineAuthChallenge Event", event);

    // tslint:disable-next-line:max-line-length
    if (event.request.session && event.request.session.length === 1 && event.request.session[0].challengeName === "CUSTOM_CHALLENGE") {
        event.response.publicChallengeParameters = {};
        event.response.privateChallengeParameters = { answer: "ok"};
        event.response.challengeMetaData = "TEMPORARY_CODE";
    }
    return event;
}

export async function verifyAuthChallengeResponse(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("VerifyAuthChallengeResponse Event", event);

    // @ts-ignore
    if (event.request.privateChallengeParameters.answer === event.request.challengeAnswer) {
        event.response.answerCorrect = true;
    } else {
        event.response.answerCorrect = false;
    }
    return event;
}
