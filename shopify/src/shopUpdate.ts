import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

import { IShopUpdateMessage } from "./interfaces";
import { writeShop } from "./lib/dynamodb";

export async function handlerAsync(event: SNSEvent, dynamodb: AWS.DynamoDB.DocumentClient): Promise<boolean> {
    console.log("Event", event);

    // Loop through each record just in case we receive multiple
    for (const record of event.Records) {
        console.log("Record.Sns", record.Sns);

        const message = JSON.parse(record.Sns.Message) as IShopUpdateMessage;
        console.log("Message", message);

        // TODO The catch() should provider some sort of retry mechanism (i.e. SQS retry, SNS notifications, etc)
        await writeShop(dynamodb, message.data, message.shopDomain);
    }

    return true;
}

export async function handler(event: SNSEvent): Promise<boolean> {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

    return await handlerAsync(event, dynamodb);
}
