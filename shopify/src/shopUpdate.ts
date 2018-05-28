import "source-map-support/register";

import { Context, SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

import { IShopUpdateMessage } from "./interfaces";
import { writeShop } from "./lib/dynamodb";
import { withAsyncMonitoring } from "./lib/monitoring";
import { snakeCase } from "./lib/string";

export async function handlerAsync(event: SNSEvent, dynamodb: AWS.DynamoDB.DocumentClient): Promise<boolean> {
    // Loop through each record just in case we receive multiple
    for (const record of event.Records) {
        console.log("Record.Sns", record.Sns);

        const message = JSON.parse(record.Sns.Message) as IShopUpdateMessage;
        console.log("Message", message);

        const { data, shopDomain } = message;

        const newData: { [pname: string]: string | number | boolean | undefined } = {};
        for (const k in data) {
            if (data[k]) {
                newData[snakeCase(k)] = data[k];
            }
        }

        // TODO The catch() should provider some sort of retry mechanism (i.e. SQS retry, SNS notifications, etc)
        await writeShop(dynamodb, newData, shopDomain);
    }

    return true;
}

export const handler = withAsyncMonitoring<SNSEvent, Context, boolean>(async (event: SNSEvent): Promise<boolean> => {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

    return await handlerAsync(event, dynamodb);
});
