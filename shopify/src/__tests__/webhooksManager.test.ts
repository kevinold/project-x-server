import { SNSEvent } from "aws-lambda";
import * as Shopify from "shopify-api-node";
import { IWebhookConfig } from "../interfaces";
import { handlerAsync } from "../webhooksManager";

test("Adds new webhooks", async () => {
    const webhooks: IWebhookConfig[] = [
        {
            address: "https://app.example.com/app/uninstalled",
            format: "json",
            snsTopicArn: "app-uninstalled-topic-arn",
            topic: "app/uninstalled",
        },
        {
            address: "https://app.example.com/shop/update",
            format: "json",
            snsTopicArn: "shop-update-topic-arn",
            topic: "shop/update",
        },
        {
            address: "https://app.example.com/products/create",
            format: "json",
            snsTopicArn: "products-create-topic-arn",
            topic: "products/create",
        },
    ];

    const event: SNSEvent = {
        Records: [{
            EventSource: "",
            EventSubscriptionArn: "",
            EventVersion: "",
            Sns: {
                Message: JSON.stringify({
                    accessToken: "accessToken",
                    data: null,
                    event: "app/auth_complete",
                    shopDomain: "example.myshopify.com",
                }),
                MessageAttributes: {},
                MessageId: "",
                Signature: "",
                SignatureVersion: "",
                SigningCertUrl: "",
                Subject: "",
                Timestamp: "",
                TopicArn: "",
                Type: "",
                UnsubscribeUrl: "",
            },
        }],
    };

    const shop = {
        webhook: {
            create: jest.fn().mockName("webhook.create").mockReturnValue({
                address: "https://app.example.com/shop/update",
                created_at: "created_at",
                fields: [],
                format: "json",
                id: 2,
                metafield_namespaces: [],
                topic: "shop/update",
                updated_at: "updated_at",
            }),
            list: jest.fn().mockName("webhook.list").mockReturnValue([
                {
                    address: "https://app.example.com/app/uninstalled",
                    created_at: "created_at",
                    fields: [],
                    format: "json",
                    id: 1,
                    metafield_namespaces: [],
                    topic: "app/uninstalled",
                    updated_at: "updated_at",
                },
            ]),
            update: jest.fn().mockName("webhook.update").mockReturnValueOnce({
                address: "https://app.example.com/app/uninstalled",
                created_at: "created_at",
                fields: [],
                format: "json",
                id: 1,
                metafield_namespaces: [],
                topic: "app/uninstalled",
                updated_at: "updated_at",
            }).mockReturnValueOnce({
                address: "https://app.example.com/products/create",
                created_at: "created_at",
                fields: [],
                format: "json",
                id: 2,
                metafield_namespaces: [],
                topic: "products/create",
                updated_at: "updated_at",
            }),
        },
    };
    const mockFactory: jest.Mock<Shopify> = jest.fn().mockReturnValue(shop) as jest.Mock<Shopify>;

    const result = await handlerAsync(
        event,
        webhooks,
        mockFactory,
    );

    expect(result).toBeTruthy();
    expect(mockFactory).toBeCalledWith("accessToken", "example.myshopify.com");
    expect(shop.webhook.list).toBeCalled();
    expect(shop.webhook.create.mock.calls.length).toBe(2);
    expect(shop.webhook.create).toBeCalledWith({
        address: "https://app.example.com/shop/update",
        format: "json",
        topic: "shop/update",
    });
    expect(shop.webhook.create).toBeCalledWith({
        address: "https://app.example.com/products/create",
        format: "json",
        topic: "products/create",
    });
});

test("Deletes old webhooks", async () => {
    const webhooks: IWebhookConfig[] = [
        {
            address: "https://app.example.com/app/uninstalled",
            format: "json",
            snsTopicArn: "app-uninstalled-topic-arn",
            topic: "app/uninstalled",
        },
    ];

    const event: SNSEvent = {
        Records: [{
            EventSource: "",
            EventSubscriptionArn: "",
            EventVersion: "",
            Sns: {
                Message: JSON.stringify({
                    accessToken: "accessToken",
                    data: null,
                    event: "app/auth_complete",
                    shopDomain: "example.myshopify.com",
                }),
                MessageAttributes: {},
                MessageId: "",
                Signature: "",
                SignatureVersion: "",
                SigningCertUrl: "",
                Subject: "",
                Timestamp: "",
                TopicArn: "",
                Type: "",
                UnsubscribeUrl: "",
            },
        }],
    };

    const shop = {
        webhook: {
            delete: jest.fn().mockName("webhook.delete"),
            list: jest.fn().mockName("webhook.list").mockReturnValue([
                {
                    address: "https://app.example.com/app/uninstalled",
                    created_at: "created_at",
                    fields: [],
                    format: "json",
                    id: 1,
                    metafield_namespaces: [],
                    topic: "app/uninstalled",
                    updated_at: "updated_at",
                },
                {
                    address: "https://app.example.com/shop/update",
                    created_at: "created_at",
                    fields: [],
                    format: "json",
                    id: 2,
                    metafield_namespaces: [],
                    topic: "shop/update",
                    updated_at: "updated_at",
                },
            ]),
            update: jest.fn().mockName("webhook.update").mockReturnValue({
                address: "https://app.example.com/app/uninstalled",
                created_at: "created_at",
                fields: [],
                format: "json",
                id: 1,
                metafield_namespaces: [],
                topic: "app/uninstalled",
                updated_at: "updated_at",
            }),
        },
    };
    const mockFactory: jest.Mock<Shopify> = jest.fn().mockReturnValue(shop) as jest.Mock<Shopify>;

    const result = await handlerAsync(
        event,
        webhooks,
        mockFactory,
    );

    expect(result).toBeTruthy();
    expect(mockFactory).toBeCalledWith("accessToken", "example.myshopify.com");
    expect(shop.webhook.list).toBeCalled();
    expect(shop.webhook.delete.mock.calls.length).toBe(1);
    expect(shop.webhook.delete).toBeCalledWith(2);
});

test("Update existing webhooks", async () => {
    const webhooks: IWebhookConfig[] = [
        {
            address: "https://app.example.com/new/app/uninstalled",
            format: "json",
            snsTopicArn: "app-uninstalled-topic-arn",
            topic: "app/uninstalled",
        },
    ];

    const event: SNSEvent = {
        Records: [{
            EventSource: "",
            EventSubscriptionArn: "",
            EventVersion: "",
            Sns: {
                Message: JSON.stringify({
                    accessToken: "accessToken",
                    data: null,
                    event: "app/auth_complete",
                    shopDomain: "example.myshopify.com",
                }),
                MessageAttributes: {},
                MessageId: "",
                Signature: "",
                SignatureVersion: "",
                SigningCertUrl: "",
                Subject: "",
                Timestamp: "",
                TopicArn: "",
                Type: "",
                UnsubscribeUrl: "",
            },
        }],
    };

    const shop = {
        webhook: {
            list: jest.fn().mockName("webhook.list").mockReturnValue([
                {
                    address: "https://app.example.com/app/uninstalled",
                    created_at: "created_at",
                    fields: [],
                    format: "json",
                    id: 1,
                    metafield_namespaces: [],
                    topic: "app/uninstalled",
                    updated_at: "updated_at",
                },
            ]),
            update: jest.fn().mockName("webhook.update").mockReturnValue({
                address: "https://app.example.com/new/app/uninstalled",
                created_at: "created_at",
                fields: [],
                format: "json",
                id: 1,
                metafield_namespaces: [],
                topic: "app/uninstalled",
                updated_at: "updated_at",
            }),
        },
    };
    const mockFactory: jest.Mock<Shopify> = jest.fn().mockReturnValue(shop) as jest.Mock<Shopify>;

    const result = await handlerAsync(
        event,
        webhooks,
        mockFactory,
    );

    expect(result).toBeTruthy();
    expect(mockFactory).toBeCalledWith("accessToken", "example.myshopify.com");
    expect(shop.webhook.list).toBeCalled();
    expect(shop.webhook.update.mock.calls.length).toBe(1);
    expect(shop.webhook.update).toBeCalledWith(1, {
        address: "https://app.example.com/new/app/uninstalled",
        format: "json",
        topic: "app/uninstalled",
    });
});
