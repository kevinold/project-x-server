import "source-map-support/register";

import { APIGatewayEvent, ProxyResult } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import fetch, { Request, RequestInit, Response } from "node-fetch";

import { IOAuthCompleteStepFunction } from "./interfaces";
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
    identityProvider: AWS.CognitoIdentityServiceProvider,
    dynamodb: AWS.DynamoDB.DocumentClient,
    stepfunctions: AWS.StepFunctions,
    fetchFn: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Promise<ProxyResult> {
    console.log("Event", event);

    try {
        const authCompleteStateMachineArn = process.env.AUTH_COMPLETE_STATE_MACHINE_ARN;
        if (!authCompleteStateMachineArn) {
            return badRequest("'AUTH_COMPLETE_STATE_MACHINE_ARN' environment variable is not set");
        }

        if (!event.body) {
            return badRequest("body is empty");
        }

        const json = JSON.parse(event.body);
        const { token, params } = json;

        if (!token) {
            return badRequest("'token' is missing");
        }

        if (!params) {
            return badRequest("'params' is missing");
        }

        const { code, shop } = params;

        if (!validateNonce(token, params)
            || !validateShopDomain(shop)
            || !validateHMAC(params)) {
            return badRequest("Invalid 'token'");
        }

        const resp = await exchangeToken(shop, code, fetchFn);
        const accessToken = resp.access_token;
        if (accessToken === undefined) {
            console.log("resp[\"access_token\"] is undefined");
            throw new Error("resp[\"access_token\"] is undefined");
        }

        const shopsTable = process.env.SHOPS_TABLE;
        if (shopsTable && shopsTable !== "") {
            await writeShop(shop, accessToken, now, shopsTable, dynamodb);
        }

        const userId = await createUser(shop, identityProvider);

        const data: IOAuthCompleteStepFunction = {
            accessToken,
            shopDomain: shop,
        };
        const stepFunctionParams: AWS.StepFunctions.StartExecutionInput = {
            input: JSON.stringify(data),
            stateMachineArn: authCompleteStateMachineArn,
        };
        await stepfunctions.startExecution(stepFunctionParams).promise();

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
    fetchFn: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Promise<IShopifyTokenResponse> {
    const body = JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
    });

    const url = `https://${shop}/admin/oauth/access_token`;

    const res = await fetchFn(url, {
        body,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method: "POST",
    });

    const json = await res.json();
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

export async function handler(event: APIGatewayEvent): Promise<ProxyResult> {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });
    const identityProvider = new AWS.CognitoIdentityServiceProvider({ apiVersion: "2016-04-18" });
    const stepfunctions = new AWS.StepFunctions({ apiVersion: "2016-11-23" });

    return await handlerAsync(event, new Date(), getRandomString(), identityProvider, dynamodb, stepfunctions, fetch);
}
