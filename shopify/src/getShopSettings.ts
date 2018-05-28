import "source-map-support/register";

import { Context } from "aws-lambda";
import * as AWS from "aws-sdk";
import fetch, { Request, RequestInit, Response } from "node-fetch";

import { IStoredShopData } from "./interfaces";
import { writeShop } from "./lib/dynamodb";
import { withAsyncMonitoring } from "./lib/monitoring";
import { GetShopSettingsQuery } from "./schema";

import * as GetShopSettingsQueryGQL from "./graphql/GetShopSettingsQuery.graphql";

export async function handlerAsync(
    event: IStoredShopData,
    dynamodb: AWS.DynamoDB.DocumentClient,
    fetchFn: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Promise<IStoredShopData> {
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

export const handler = withAsyncMonitoring<IStoredShopData, Context, IStoredShopData>(
    async (event: IStoredShopData): Promise<IStoredShopData> => {
        const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

        return await handlerAsync(event, dynamodb, fetch);
    });
