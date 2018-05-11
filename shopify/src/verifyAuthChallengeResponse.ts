import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";
import * as jwt from "jsonwebtoken";

import { Log } from "./lib/log";

export async function handler(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("VerifyAuthChallengeResponse Event", event);
    Log.info("VerifyAuthChallengeResponse Request", event.request);
    Log.info("VerifyAuthChallengeResponse Response", event.response);
    console.log("VerifyAuthChallengeResponse Event", event);
    console.log("VerifyAuthChallengeResponse Request", event.request);
    console.log("VerifyAuthChallengeResponse Response (In)", event.response);

    const jwtSecret = process.env.JWT_SECRET;
    // @ts-ignore
    const challengeAnswer: string = event.request.challengeAnswer;
    if (!jwtSecret || !challengeAnswer) {
        console.log("No JWT_SECRET or challengeAnswer");
        event.response.answerCorrect = false;
    } else {
        try {
            jwt.verify(challengeAnswer, jwtSecret, {
                clockTolerance: 600,
                issuer: process.env.JWT_ISS || "",
                subject: event.userName,
            });
            event.response.answerCorrect = true;
        } catch (err) {
            Log.error("Error verifying nonce", err);
            event.response.answerCorrect = false;
        }
    }

    // @ts-ignore
    // if (event.request.privateChallengeParameters.answer === event.request.challengeAnswer) {
    //     event.response.answerCorrect = true;
    // } else {
    //     event.response.answerCorrect = false;
    // }
    console.log("VerifyAuthChallengeResponse Response (Out)", event.response);

    return event;
}
