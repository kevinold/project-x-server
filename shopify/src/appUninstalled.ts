import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

import { IAppUninstalledMessage } from "./interfaces";
import { Log } from "./lib/log";

export async function handlerAsync(
    event: SNSEvent,
    dynamodb: AWS.DynamoDB.DocumentClient,
    now: Date,
): Promise <boolean> {
    for (const record of event.Records) {
        Log.info("Record.SNS", record.Sns);
        const message = JSON.parse(record.Sns.Message) as IAppUninstalledMessage;
        Log.info("Message", message);

        const getItemParams: AWS.DynamoDB.DocumentClient.GetItemInput = {
            Key: { shopDomain: message.shopDomain },
            TableName: process.env.SHOPS_TABLE || "",
        };
        const item = await dynamodb.get(getItemParams).promise();

        if (!item.Item) {
            Log.info("item.Item is undefined or null");
            return false;
        }

        // Save the old shop record under a new key
        const extra: AWS.DynamoDB.DocumentClient.AttributeMap = {
            shopDomain: item.Item.shopDomain + "-uninstalled-" + now.getTime().toString(),
            uninstalledAt: now.toISOString(),
        };
        const data = { ...item.Item, ...extra };
        Log.info(data);

        const putItemParams: AWS.DynamoDB.PutItemInput = {
            Item: data,
            TableName: process.env.SHOPS_TABLE || "",
        };
        await dynamodb.put(putItemParams).promise();

        // Delete the old shop record
        const deleteItemParams: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
            Key: {
                shopDomain: message.shopDomain,
            },
            TableName: process.env.SHOPS_TABLE || "",
        };
        await dynamodb.delete(deleteItemParams).promise();
    }

    return true;
}

export async function handler(event: SNSEvent): Promise <boolean> {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

    return await handlerAsync(event, dynamodb, new Date());
}
