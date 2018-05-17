import { IShop } from "shopify-api-node";

import { snakeCase } from "./string";

export async function writeShop(
    dynamodb: AWS.DynamoDB.DocumentClient,
    shop: IShop,
    shopDomain: string,
): Promise<AWS.DynamoDB.UpdateItemOutput> {
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    const updateFields = [];
    let k: keyof IShop;
    let p = 0;
    for (k in shop) {
        if (shop[k]) {
            const key = `P${p++}`;
            const field = snakeCase(k);
            const val = shop[k];

            // For these fields convert null and undefined to false
            if (["taxShipping", "taxesIncluded", "countyTaxes"].findIndex((v) => v === field) !== undefined
                && (val === null || val === undefined)) {
                expressionAttributeValues[`:${key}`] = false;
            } else {
                expressionAttributeValues[`:${key}`] = val;
            }

            updateFields.push(`#${key} = :${key}`);
            expressionAttributeNames["#" + key] = field;
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
    console.log("Update Item", updateParams);
    return dynamodb.update(updateParams).promise();
}
