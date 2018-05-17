import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";
import * as jwt from "jsonwebtoken";

export async function handler(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    console.log("Event", event);

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
            console.log("Error verifying nonce", err);
            event.response.answerCorrect = false;
        }
    }

    console.log("Response", event.response);

    return event;
}
