import { APIGatewayEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as crypto from "crypto";
import * as fetch from "jest-fetch-mock";

import { handlerAsync } from "../authComplete";
import { createJWT } from "../lib/jwt";

beforeAll(() => {
    process.env.AUTH_COMPLETE_STATE_MACHINE_ARN = "auth-complete-step-function-arn";
    process.env.JWT_ISS = "jwt-iss";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SHOPIFY_API_KEY = "shopify-api-key";
    process.env.SHOPIFY_API_SECRET = "shopify-api-secret";
    process.env.SHOPIFY_SCOPE = "read_script_tags:write_script_tags";
    process.env.SHOPS_TABLE = "shops";
    process.env.USER_POOL_ID = "user-pool-id";
});

afterAll(() => {
    delete process.env.AUTH_COMPLETE_STATE_MACHINE_ARN;
    delete process.env.JWT_ISS;
    delete process.env.JWT_SECRET;
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.SHOPIFY_SCOPE;
    delete process.env.SHOPS_TABLE;
    delete process.env.USER_POOL_ID;
});

test("Creates a new user", async () => {
    const state = "KHJVSFIUYRTBX*&3bri734bt";
    const shop = "example.myshopify.com";

    const token = createJWT("example.myshopify.com", state, new Date(), 600);

    const params: { [pname: string]: string } = {
        code: "1234",
        hmac: "",
        shop,
        state,
    };

    const p = [];
    for (const k in params) {
        if (k !== "hmac") {
            k.replace("%", "%25");
            p.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k].toString()));
        }
    }
    const message = p.sort().join("&");

    const hmac = crypto.createHmac("SHA256", process.env.SHOPIFY_API_SECRET || "").update(message).digest("hex");

    const event: APIGatewayEvent = {
        body: JSON.stringify({
            params: {
                ...params,
                hmac,
            },
            token,
        }),
        headers: {},
        httpMethod: "POST",
        isBase64Encoded: false,
        path: "",
        pathParameters: null,
        queryStringParameters: null,
        requestContext: {
            accountId: "",
            apiId: "",
            authorizer: null,
            httpMethod: "POST",
            identity: {
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                sourceIp: "127.0.0.1",
                user: null,
                userAgent: null,
                userArn: null,
            },
            path: "",
            requestId: "",
            requestTimeEpoch: 0,
            resourceId: "",
            resourcePath: "",
            stage: "test",
        },
        resource: "",
        stageVariables: null,
    };

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.update = jest.fn().mockName("dynamodb.update").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const identityProvider = new AWS.CognitoIdentityServiceProvider({ apiVersion: "2016-04-18" });
    identityProvider.adminCreateUser = jest.fn().mockName("identityProvider.adminCreateUser").mockReturnValueOnce({
        promise: () => new Promise((resolve) => resolve({
            User: {
                Username: "xxxx",
            },
        })),
    });
    identityProvider.adminGetUser = jest.fn().mockName("identityProvider.adminGetUser").mockReturnValueOnce({
        promise: () => new Promise((resolve) => resolve({
            User: {
                Username: "xxxx",
            },
        })),
    });

    const stepFunctions = new AWS.StepFunctions({ apiVersion: "2016-11-23" });
    stepFunctions.startExecution = jest.fn().mockName("stepFunctions.startExecution").mockReturnValueOnce({
        promise: () => new Promise((resolve) => resolve({})),
    });

    fetch.resetMocks();
    fetch.mockResponseOnce(JSON.stringify({
        access_token: "access_token",
    }));

    const now = new Date(1525917740);
    const result = await handlerAsync(
        event,
        now,
        "randomString",
        identityProvider,
        dynamodb,
        stepFunctions,
        // @ts-ignore
        fetch,
    );

    expect(result).toEqual({
        // tslint:disable-next-line:max-line-length
        body: "{\"chargeAuthorizationUrl\":null,\"token\":\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MjY1MTcsImlhdCI6MTUyNTkxNywiaXNzIjoiand0LWlzcyIsImp0aSI6InJhbmRvbVN0cmluZyIsInN1YiI6Inh4eHgifQ.cTS9aKYWSp8A_lIwUmw3lPF9lwI2ER0vYqMXqNFR19E\"}",
        headers: {
            "Access-Control-Allow-Credentials": true,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
        statusCode: 200,
    });
    expect(fetch).toBeCalledWith(
        "https://example.myshopify.com/admin/oauth/access_token",
        {
            body: "{\"client_id\":\"shopify-api-key\",\"client_secret\":\"shopify-api-secret\",\"code\":\"1234\"}",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            method: "POST",
        });
    expect(dynamodb.update).toBeCalledWith({
        ExpressionAttributeValues: {
            ":accessToken": "access_token",
            ":installedAt": now.getTime(),
            ":platform": "shopify",
        },
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
        UpdateExpression: "SET platform = :platform, accessToken = :accessToken, installedAt = :installedAt",
    });
    expect(identityProvider.adminCreateUser).toBeCalledWith({
        MessageAction: "SUPPRESS",
        UserAttributes: [
            { Name: "email", Value: "example@myshopify.com" },
            { Name: "name", Value: "example.myshopify.com" },
            { Name: "website", Value: "example.myshopify.com" },
        ],
        UserPoolId: "user-pool-id",
        Username: "example@myshopify.com",
    });
    expect(identityProvider.adminGetUser).not.toBeCalled();
    expect(stepFunctions.startExecution).toBeCalledWith({
        input: JSON.stringify({ accessToken: "access_token", shopDomain: shop }),
        stateMachineArn: "auth-complete-step-function-arn",
    });
});

test("Finds an existing user", async () => {
    const state = "KHJVSFIUYRTBX*&3bri734bt";
    const shop = "example.myshopify.com";

    const token = createJWT("example.myshopify.com", state, new Date(), 600);

    const params: { [pname: string]: string } = {
        code: "1234",
        hmac: "",
        shop,
        state,
    };

    const p = [];
    for (const k in params) {
        if (k !== "hmac") {
            k.replace("%", "%25");
            p.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k].toString()));
        }
    }
    const message = p.sort().join("&");

    const hmac = crypto.createHmac("SHA256", process.env.SHOPIFY_API_SECRET || "").update(message).digest("hex");

    const event: APIGatewayEvent = {
        body: JSON.stringify({
            params: {
                ...params,
                hmac,
            },
            token,
        }),
        headers: {},
        httpMethod: "POST",
        isBase64Encoded: false,
        path: "",
        pathParameters: null,
        queryStringParameters: null,
        requestContext: {
            accountId: "",
            apiId: "",
            authorizer: null,
            httpMethod: "POST",
            identity: {
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                sourceIp: "127.0.0.1",
                user: null,
                userAgent: null,
                userArn: null,
            },
            path: "",
            requestId: "",
            requestTimeEpoch: 0,
            resourceId: "",
            resourcePath: "",
            stage: "test",
        },
        resource: "",
        stageVariables: null,
    };

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.update = jest.fn().mockName("dynamodb.update").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const identityProvider = new AWS.CognitoIdentityServiceProvider({ apiVersion: "2016-04-18" });
    identityProvider.adminCreateUser = jest.fn().mockName("identityProvider.adminCreateUser").mockReturnValueOnce({
        promise: () => new Promise((_resolve, reject) => reject({ code: "UsernameExistsException" })),
    });
    identityProvider.adminGetUser = jest.fn().mockName("identityProvider.adminGetUser").mockReturnValueOnce({
        promise: () => new Promise((resolve) => resolve({
            User: {
                Username: "xxxx",
            },
        })),
    });

    const stepFunctions = new AWS.StepFunctions({ apiVersion: "2016-11-23" });
    stepFunctions.startExecution = jest.fn().mockName("stepFunctions.startExecution").mockReturnValueOnce({
        promise: () => new Promise((resolve) => resolve({})),
    });

    fetch.resetMocks();
    fetch.mockResponseOnce(JSON.stringify({
        access_token: "access_token",
    }));

    const now = new Date(1525917740);
    const result = await handlerAsync(
        event,
        now,
        "randomString",
        identityProvider,
        dynamodb,
        stepFunctions,
        // @ts-ignore
        fetch,
    );

    expect(result).toEqual({
        // tslint:disable-next-line:max-line-length
        body: "{\"chargeAuthorizationUrl\":null,\"token\":\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MjY1MTcsImlhdCI6MTUyNTkxNywiaXNzIjoiand0LWlzcyIsImp0aSI6InJhbmRvbVN0cmluZyJ9.FOTAt2y7ct5rtYHllsCgpDg8fvOQkmb-4b8V3Ho2SY8\"}",
        headers: {
            "Access-Control-Allow-Credentials": true,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
        statusCode: 200,
    });
    expect(fetch).toBeCalledWith(
        "https://example.myshopify.com/admin/oauth/access_token",
        {
            body: "{\"client_id\":\"shopify-api-key\",\"client_secret\":\"shopify-api-secret\",\"code\":\"1234\"}",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            method: "POST",
        });
    expect(dynamodb.update).toBeCalledWith({
        ExpressionAttributeValues: {
            ":accessToken": "access_token",
            ":installedAt": now.getTime(),
            ":platform": "shopify",
        },
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
        UpdateExpression: "SET platform = :platform, accessToken = :accessToken, installedAt = :installedAt",
    });
    expect(identityProvider.adminCreateUser).toBeCalledWith({
        MessageAction: "SUPPRESS",
        UserAttributes: [
            { Name: "email", Value: "example@myshopify.com" },
            { Name: "name", Value: "example.myshopify.com" },
            { Name: "website", Value: "example.myshopify.com" },
        ],
        UserPoolId: "user-pool-id",
        Username: "example@myshopify.com",
    });
    expect(identityProvider.adminGetUser).toBeCalledWith({
        UserPoolId: "user-pool-id",
        Username: "example@myshopify.com",
    });
    expect(stepFunctions.startExecution).toBeCalledWith({
        input: JSON.stringify({ accessToken: "access_token", shopDomain: shop }),
        stateMachineArn: "auth-complete-step-function-arn",
    });
});
