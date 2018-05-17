import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

import { IAppUninstalledMessage } from "./interfaces";

export async function handlerAsync(
    event: SNSEvent,
    dynamodb: AWS.DynamoDB.DocumentClient,
): Promise <boolean> {
    console.log("Event", event);

    for (const record of event.Records) {
        console.log("Record.SNS", record.Sns);
        const message = JSON.parse(record.Sns.Message) as IAppUninstalledMessage;
        console.log("Message", message);

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

    return await handlerAsync(event, dynamodb);
}
