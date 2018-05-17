import { CognitoUserPoolEvent } from "aws-lambda";
import { handler } from "../preSignUp";

test("Auto verifies @myshopify.com accounts", async () => {
    const event: CognitoUserPoolEvent = {
        callerContext: {
            awsSdkVersion: "1",
            clientId: "",
        },
        region: "",
        request: {
            userAttributes: {
                email: "test@myshopify.com",
            },
        },
        response: {
            autoConfirmUser: false,
        },
        triggerSource: "PreSignUp_SignUp",
        userPoolId: "",
        version: 1,
    };

    const result = await handler(event);

    expect(result.response.autoConfirmUser).toBeTruthy();
});

test("Does not auto verify @example.com accounts", async () => {
    const event: CognitoUserPoolEvent = {
        callerContext: {
            awsSdkVersion: "1",
            clientId: "",
        },
        region: "",
        request: {
            userAttributes: {
                email: "test@example.com",
            },
        },
        response: {
            autoConfirmUser: false,
        },
        triggerSource: "PreSignUp_SignUp",
        userPoolId: "",
        version: 1,
    };

    const result = await handler(event);

    expect(result.response.autoConfirmUser).toBeFalsy();
});
