import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import { IShop } from "shopify-api-node";

import { IShopUpdateMessage } from "./interfaces";
import { Log } from "./lib/log";
import { snakeCase } from "./lib/string";

export async function handlerAsync(event: SNSEvent, dynamodb: AWS.DynamoDB.DocumentClient): Promise<boolean> {
    // Loop through each record just in case we receive multiple
    for (const record of event.Records) {
        Log.info("Record.Sns", record.Sns);

        const message = JSON.parse(record.Sns.Message) as IShopUpdateMessage;
        Log.info("Message", message);

        // TODO The catch() should provider some sort of retry mechanism (i.e. SQS retry, SNS notifications, etc)
        await writeShop(dynamodb, message.data, message.shopDomain);
    }

    return true;
}

async function writeShop(
    dynamodb: AWS.DynamoDB.DocumentClient,
    shop: IShop,
    shopDomain: string,
): Promise<AWS.DynamoDB.UpdateItemOutput> {
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    const updateFields = [];
    let k: keyof IShop;
    for (k in shop) {
        if (shop[k]) {
            const keyMap: { [pname: string]: string } = {
                domain: "D",
                name: "N",
                source: "S",
                timezone: "T",
            };

            const key = keyMap[k] ? keyMap[k] : snakeCase(k);
            const val = shop[k];

            if ((val === null || val === undefined) && k in ["taxShipping", "taxesIncluded", "countyTaxes"]) {
                expressionAttributeValues[":" + key] = false;
            } else {
                expressionAttributeValues[":" + key] = val;
            }

            if ((":" + key) in expressionAttributeValues) {
                if (key === k) {
                    updateFields.push(key + " = :" + key);
                } else {
                    updateFields.push("#" + key + " = :" + key);
                    expressionAttributeNames["#" + key] = k;
                }
            }
        }
    }

    const updateExpression = "SET " + updateFields.join(", ");

    const updateParams = {
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        Key: {
            shopDomain,
        },
        TableName: process.env.SHOPS_TABLE || "",
        UpdateExpression: updateExpression,
    };
    Log.info("Update Item", updateParams);
    return dynamodb.update(updateParams).promise();
}

export async function handler(event: SNSEvent): Promise<boolean> {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

    return await handlerAsync(event, dynamodb);
}
