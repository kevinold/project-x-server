import { APIGatewayEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as crypto from "crypto";

import { handlerAsync } from "../authComplete";
import { createJWT } from "../lib/jwt";

beforeAll(() => {
    process.env.AUTH_COMPLETE_TOPIC_ARN = "app-installed-topic-arn";
    process.env.JWT_ISS = "jwt-iss";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SHOPIFY_API_KEY = "shopify-api-key";
    process.env.SHOPIFY_API_SECRET = "shopify-api-secret";
    process.env.SHOPIFY_SCOPE = "read_script_tags:write_script_tags";
    process.env.SHOPS_TABLE = "shops";
    process.env.USER_POOL_ID = "user-pool-id";
});

afterAll(() => {
    delete process.env.AUTH_COMPLETE_TOPIC_ARN;
    delete process.env.JWT_ISS;
    delete process.env.JWT_SECRET;
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.SHOPIFY_SCOPE;
    delete process.env.SHOPS_TABLE;
    delete process.env.USER_POOL_ID;
});

test("A valid GET returns 200 and a valid object", async () => {
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
            requestId: "",
            requestTimeEpoch: 0,
            resourceId: "",
            resourcePath: "",
            stage: "test",
        },
        resource: "",
        stageVariables: null,
    };

    const sns = new AWS.SNS({ apiVersion: "2010-03-31" });
    sns.publish = jest.fn().mockName("sns.publish").mockReturnValue({
        promise: () => new Promise<AWS.SNS.PublishResponse>((resolve) => resolve({
            MessageId: "1",
        })),
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.update = jest.fn().mockName("dynamodb.update").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const identityProvider = new AWS.CognitoIdentityServiceProvider({apiVersion: "2016-04-18"});

    const post = jest.fn().mockReturnValue(new Promise((resolve) => resolve({
        body: {
            access_token: "access_token",
        },
    })));

    const now = new Date(1525917740);
    const result = await handlerAsync(event, now, "randomString", post, identityProvider, dynamodb, sns);

    expect(result).toEqual({
        // tslint:disable-next-line:max-line-length
        body: "{\"chargeAuthorizationUrl\":null,\"token\":\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1NjkxMTcsImlhdCI6MTUyNTkxNywiaXNzIjoiand0LWlzcyIsImp0aSI6InJhbmRvbVN0cmluZyIsInN1YiI6ImV4YW1wbGUubXlzaG9waWZ5LmNvbSJ9.bcw_lETK3g9GeQ47TDQyVEWmelVwcg2JqDVRraopWXU\"}",
        headers: {
            "Access-Control-Allow-Credentials": true,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
        statusCode: 200,
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
    expect(sns.publish).toBeCalledWith({
        // tslint:disable-next-line:max-line-length
        Message: "{\"accessToken\":\"access_token\",\"data\":null,\"event\":\"app/auth_complete\",\"shopDomain\":\"example.myshopify.com\"}",
        TopicArn: "app-installed-topic-arn",
    });
});
