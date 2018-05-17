import "source-map-support/register";

import { APIGatewayEvent, ProxyResult } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as crypto from "crypto";
import * as got from "got";
import * as jwt from "jsonwebtoken";

import { badRequest, internalError, ok } from "./lib/http";
import { createJWT } from "./lib/jwt";
import { getRandomString } from "./lib/string";

// The shape of the token exchange response from Shopify
interface IShopifyTokenResponse {
    error?: string;
    errors?: string;
    error_description?: string;
    access_token?: string;
    scope?: string;
}

export async function handlerAsync(
    event: APIGatewayEvent,
    now: Date,
    nonce: string,
    post: (url: got.GotUrl, options: got.GotJSONOptions) => got.GotPromise<any>,
    identityProvider: AWS.CognitoIdentityServiceProvider,
    dynamodb: AWS.DynamoDB.DocumentClient,
    sns: AWS.SNS): Promise<ProxyResult> {
    console.log("Event", event);

    try {
        if (!event.body) {
            return badRequest("body is empty");
        }

        const json = JSON.parse(event.body);

        if (!json.token) {
            return badRequest("'token' is missing");
        }

        if (!json.params) {
            return badRequest("'params' is missing");
        }

        if (!validateNonce(json.token, json.params)
            || !validateShopDomain(json.params.shop)
            || !validateHMAC(json.params)) {
            return badRequest("Invalid 'token'");
        }

        const resp = await exchangeToken(json.params.shop, json.params.code, post);
        const accessToken = resp.access_token;
        if (accessToken === undefined) {
            console.log("resp[\"access_token\"] is undefined");
            throw new Error("resp[\"access_token\"] is undefined");
        }

        const shopsTable = process.env.SHOPS_TABLE;
        if (shopsTable && shopsTable !== "") {
            await writeShop(json.params.shop, accessToken, now, shopsTable, dynamodb);
        }

        const userId = await createUser(json.params.shop, identityProvider);
        const result = await sendAuthCompleteNotification(json.params.shop, accessToken, sns);
        console.log("Message ID", result.MessageId);

        // Return the authURL
        return ok({
            chargeAuthorizationUrl: null,
            token: createJWT(userId, nonce, now, 600),
        });
    } catch (e) {
        console.log("Error", e);
        return internalError();
    }
}

// Validate the nonce against the token
function validateNonce(token: string, params: any): boolean {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET environment variable is not set");
    }

    try {
        jwt.verify(token, jwtSecret, {
            clockTolerance: 600,
            issuer: process.env.JWT_ISS || "",
            jwtid: params.state,
            subject: params.shop,
        });
        return true;

    } catch (err) {
        console.log("Error verifying nonce", err);
        return false;
    }
}

// Check that the shopDomain is a valid myshop.com domain. This is required by Shopify
function validateShopDomain(shopDomain: string): boolean {
    if (shopDomain.match(/^[a-z][a-z0-9\-]*\.myshopify\.com$/i) === null) {
        console.log("Shop validation failed", shopDomain);
        return false;
    }

    return true;
}

// Validate the HMAC parameter
function validateHMAC(params: any): boolean {
    const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
    if (!shopifyApiSecret) {
        throw new Error("SHOPIFY_API_SECRET environment variable not set");
    }

    const p = [];
    for (const k in params) {
        if (k !== "hmac") {
            k.replace("%", "%25");
            p.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k].toString()));
        }
    }
    const message = p.sort().join("&");

    const digest = crypto.createHmac("SHA256", shopifyApiSecret).update(message).digest("hex");

    return (digest === params.hmac);
}

// Exchange the temporary code the permanent API token
async function exchangeToken(
    shop: string,
    code: string,
    post: (url: got.GotUrl, options: got.GotJSONOptions) => got.GotPromise<any>): Promise<IShopifyTokenResponse> {
    const body = {
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
    };

    const url = `https://${shop}/admin/oauth/access_token`;

    const options: got.GotJSONOptions = {
        body,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        json: true,
        method: "POST",
    };

    const res: got.Response<IShopifyTokenResponse> = await post(url, options);
    const json = res.body;
    console.log("Shopify Token Exchange Response", json);
    if ("error_description" in json || "error" in json || "errors" in json) {
        throw new Error(json.error_description || json.error || json.errors);
    }
    return json;
}

// Create the user if they don't already exist
async function createUser(
    shopDomain: string,
    identityProvider: AWS.CognitoIdentityServiceProvider): Promise<string> {
    const userPoolId = process.env.USER_POOL_ID;
    if (!userPoolId) {
        throw new Error("USER_POOL_ID environment variable not set");
    }

    const email = shopDomain.replace(".myshopify.com", "@myshopify.com");

    const userParams: AWS.CognitoIdentityServiceProvider.AdminCreateUserRequest = {
        MessageAction: "SUPPRESS",
        UserAttributes: [
            { Name: "email", Value: email },
            { Name: "name", Value: shopDomain },
            { Name: "website", Value: shopDomain },
        ],
        UserPoolId: userPoolId,
        Username: email,
    };
    console.log("Admin Create User", userParams);

    try {
        const result = await identityProvider.adminCreateUser(userParams).promise();
        if (result.User && result.User.Username) {
            return result.User.Username;
        }

        throw Error("No username!!");
    } catch (err) {
        if (err.code === "UsernameExistsException") {
            const user = await identityProvider.adminGetUser({
                UserPoolId: userPoolId,
                Username: email,
            }).promise();

            return user.Username;
        }

        throw err;
    }
}

// Write the shop record to the dynamodb table
async function writeShop(
    shopDomain: string,
    accessToken: string,
    now: Date,
    shopsTable: string,
    dynamodb: AWS.DynamoDB.DocumentClient): Promise<AWS.DynamoDB.UpdateItemOutput> {

    const updateParams = {
        ExpressionAttributeValues: {
            ":accessToken": accessToken,
            ":installedAt": now.getTime(),
            ":platform": "shopify",
        },
        Key: {
            shopDomain,
        },
        TableName: shopsTable,
        UpdateExpression: "SET platform = :platform, accessToken = :accessToken, installedAt = :installedAt",
    };
    console.log("Update Item", updateParams);

    // TODO Retrieve the shop first and only set installedAt ONCE
    return dynamodb.update(updateParams).promise();
}

// Send the SNS notification that the application has been installed
async function sendAuthCompleteNotification(
    shopDomain: string,
    accessToken: string,
    sns: AWS.SNS): Promise<AWS.SNS.PublishResponse> {
    const message = {
        accessToken,
        data: null,
        event: "app/auth_complete",
        shopDomain,
    };

    const params = {
        Message: JSON.stringify(message),
        TopicArn: process.env.AUTH_COMPLETE_TOPIC_ARN,
    };

    return sns.publish(params).promise();
}

export async function handler(event: APIGatewayEvent): Promise<ProxyResult> {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });
    const sns = new AWS.SNS({ apiVersion: "2010-03-31" });
    const identityProvider = new AWS.CognitoIdentityServiceProvider({ apiVersion: "2016-04-18" });

    return await handlerAsync(event, new Date(), getRandomString(), got.post, identityProvider, dynamodb, sns);
}
