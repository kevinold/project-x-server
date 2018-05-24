import "source-map-support/register";

import * as AWS from "aws-sdk";
import fetch, { Request, RequestInit, Response } from "node-fetch";

import { IOAuthCompleteStepFunction } from "./interfaces";
import { writeShop } from "./lib/dynamodb";
import { GetShopSettingsQuery } from "./schema";

import * as GetShopSettingsQueryGQL from "./graphql/GetShopSettingsQuery.graphql";

export async function handlerAsync(
    event: IOAuthCompleteStepFunction,
    dynamodb: AWS.DynamoDB.DocumentClient,
    fetchFn: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Promise<IOAuthCompleteStepFunction> {
    console.log("Event", event);

    const { accessToken, shopDomain } = event;

    const resp = await fetchFn(`https://${shopDomain}/admin/api/graphql.json`, {
        body: GetShopSettingsQueryGQL,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/graphql",
            "X-Shopify-Access-Token": accessToken,
        },
        method: "POST",
    });

    const json = await resp.json();
    const shop = (json.data as GetShopSettingsQuery).shop;

    await writeShop(dynamodb, shop, shopDomain);

    return event;
}

export async function handler(event: IOAuthCompleteStepFunction): Promise<IOAuthCompleteStepFunction> {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

    return await handlerAsync(event, dynamodb, fetch);
}
