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
    fetch.mockResponseOnce(JSON.stringify({
        shop: {
            address1: "",
            address2: "",
            city: "",
            country: "",
            country_code: "",
            country_name: "",
            county_taxes: "",
            created_at: "",
            currency: "",
            customer_email: null,
            domain: "",
            eligible_for_card_reader_giveaway: false,
            eligible_for_payments: false,
            email: "",
            finances: false,
            force_ssl: true,
            google_apps_domain: null,
            google_apps_login_enabled: null,
            has_discounts: false,
            has_gift_cards: false,
            has_storefront: false,
            iana_timezone: "",
            id: 1,
            latitude: 1,
            longitude: 1,
            money_format: "",
            money_in_emails_format: "",
            money_with_currency_format: "",
            money_with_currency_in_emails_format: "",
            myshopify_domain: "",
            name: "",
            password_enabled: false,
            phone: null,
            plan_display_name: "",
            plan_name: "",
            primary_locale: "",
            primary_location_id: 1,
            province: "",
            province_code: "",
            requires_extra_payments_agreement: false,
            setup_required: false,
            shop_owner: "",
            source: null,
            tax_shipping: null,
            taxes_included: null,
            timezone: "",
            updated_at: "",
            weight_unit: "",
            zip: "",
        },
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
        ExpressionAttributeNames: {
            "#P0": "accessToken",
            "#P1": "installedAt",
            "#P2": "platform",
            "#P3": "shopifyId",
        },
        ExpressionAttributeValues: {
            ":P0": "access_token",
            ":P1": "1970-01-18T15:51:57.740Z",
            ":P2": "shopify",
            ":P3": 1,
        },
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
        UpdateExpression: "SET #P0 = :P0, #P1 = :P1, #P2 = :P2, #P3 = :P3",
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
        // tslint:disable-next-line:max-line-length
        input: "{\"accessToken\":\"access_token\",\"country\":\"\",\"email\":\"\",\"installedAt\":\"1970-01-18T15:51:57.740Z\",\"name\":\"\",\"planDisplayName\":\"\",\"planName\":\"\",\"platform\":\"shopify\",\"shopDomain\":\"example.myshopify.com\",\"shopifyId\":1,\"timezone\":\"\"}",
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
    fetch.mockResponseOnce(JSON.stringify({
        shop: {
            address1: "",
            address2: "",
            city: "",
            country: "",
            country_code: "",
            country_name: "",
            county_taxes: "",
            created_at: "",
            currency: "",
            customer_email: null,
            domain: "",
            eligible_for_card_reader_giveaway: false,
            eligible_for_payments: false,
            email: "",
            finances: false,
            force_ssl: true,
            google_apps_domain: null,
            google_apps_login_enabled: null,
            has_discounts: false,
            has_gift_cards: false,
            has_storefront: false,
            iana_timezone: "",
            id: 1,
            latitude: 1,
            longitude: 1,
            money_format: "",
            money_in_emails_format: "",
            money_with_currency_format: "",
            money_with_currency_in_emails_format: "",
            myshopify_domain: "",
            name: "",
            password_enabled: false,
            phone: null,
            plan_display_name: "",
            plan_name: "",
            primary_locale: "",
            primary_location_id: 1,
            province: "",
            province_code: "",
            requires_extra_payments_agreement: false,
            setup_required: false,
            shop_owner: "",
            source: null,
            tax_shipping: null,
            taxes_included: null,
            timezone: "",
            updated_at: "",
            weight_unit: "",
            zip: "",
        },
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
        ExpressionAttributeNames: {
            "#P0": "accessToken",
            "#P1": "installedAt",
            "#P2": "platform",
            "#P3": "shopifyId",
        },
        ExpressionAttributeValues: {
            ":P0": "access_token",
            ":P1": "1970-01-18T15:51:57.740Z",
            ":P2": "shopify",
            ":P3": 1,
        },
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
        UpdateExpression: "SET #P0 = :P0, #P1 = :P1, #P2 = :P2, #P3 = :P3",
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
        // tslint:disable-next-line:max-line-length
        input: "{\"accessToken\":\"access_token\",\"country\":\"\",\"email\":\"\",\"installedAt\":\"1970-01-18T15:51:57.740Z\",\"name\":\"\",\"planDisplayName\":\"\",\"planName\":\"\",\"platform\":\"shopify\",\"shopDomain\":\"example.myshopify.com\",\"shopifyId\":1,\"timezone\":\"\"}",
        stateMachineArn: "auth-complete-step-function-arn",
    });
});
