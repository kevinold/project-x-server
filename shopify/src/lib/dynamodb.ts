export async function writeShop(
    dynamodb: AWS.DynamoDB.DocumentClient,
    shop: { [pname: string]: string | number | boolean | undefined },
    shopDomain: string,
): Promise<AWS.DynamoDB.UpdateItemOutput> {
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    const updateFields = [];
    let p = 0;
    for (const field in shop) {
        if (field !== "shopDomain" && shop[field]) {
            const key = `P${p++}`;
            const val = shop[field];

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
