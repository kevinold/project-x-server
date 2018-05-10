import { SNSEvent } from "aws-lambda";
import * as Shopify from "shopify-api-node";
import { ICreateScriptTag } from "shopify-api-node";
import { handlerAsync } from "../scriptTagsManager";

beforeAll(() => {
    process.env.SHOPS_TABLE = "shops";
    process.env.APP_INSTALLED_TOPIC_ARN = "app_install_topic";
});

afterAll(() => {
    delete process.env.SHOPS_TABLE;
    delete process.env.APP_INSTALLED_TOPIC_ARN;
});

function mockSnsEvent(): SNSEvent {
    return {
        Records: [{
            EventSource: "",
            EventSubscriptionArn: "",
            EventVersion: "",
            Sns: {
                Message: JSON.stringify({
                    accessToken: "accessToken",
                    data: null,
                    event: "app/uninstalled",
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
}

test("Adds new script tags", async () => {
    const event: SNSEvent = mockSnsEvent();

    const shop = {
        scriptTag: {
            create: jest.fn().mockName("scriptTag.create").mockReturnValue({
                created_at: "created_at",
                display_scope: "all",
                event: "onload",
                id: 2,
                src: "https://example.com/2",
                updated_at: "updated_at",
            }),
            list: jest.fn().mockName("scriptTag.list").mockReturnValue([
                {
                    created_at: "created_at",
                    display_scope: "all",
                    event: "onload",
                    id: 1,
                    src: "https://example.com/1",
                    updated_at: "updated_at",
                },
            ]),
            update: jest.fn().mockName("scriptTag.update").mockReturnValue({
                created_at: "created_at",
                display_scope: "all",
                event: "onload",
                id: 1,
                src: "https://example.com/1",
                updated_at: "updated_at",
            }),
        },
    };
    const mockFactory: jest.Mock<Shopify> = jest.fn().mockReturnValue(shop) as jest.Mock<Shopify>;

    const scriptTags: ICreateScriptTag[] = [
        {
            display_scope: "all",
            event: "onload",
            src: "https://example.com/1",
        },
        {
            display_scope: "all",
            event: "onload",
            src: "https://example.com/2",
        },
    ];

    const result = await handlerAsync(
        event,
        mockFactory,
        scriptTags,
    );

    expect(result).toBeTruthy();
    expect(mockFactory).toBeCalledWith("accessToken", "example.myshopify.com");
    expect(shop.scriptTag.list).toBeCalled();
    expect(shop.scriptTag.create.mock.calls.length).toBe(1);
    expect(shop.scriptTag.create).toBeCalledWith({
        display_scope: "all",
        event: "onload",
        src: "https://example.com/2",
    });
});

test("Deletes old script tags", async () => {
    const event: SNSEvent = mockSnsEvent();

    const shop = {
        scriptTag: {
            delete: jest.fn().mockName("scriptTag.delete"),
            list: jest.fn().mockName("scriptTag.list").mockReturnValue([
                {
                    created_at: "created_at",
                    display_scope: "all",
                    event: "onload",
                    id: 1,
                    src: "https://example.com/1",
                    updated_at: "updated_at",
                },
                {
                    created_at: "created_at",
                    display_scope: "all",
                    event: "onload",
                    id: 2,
                    src: "https://example.com/2",
                    updated_at: "updated_at",
                },
            ]),
            update: jest.fn().mockName("scriptTag.update").mockReturnValue({
                created_at: "created_at",
                display_scope: "all",
                event: "onload",
                id: 1,
                src: "https://example.com/1",
                updated_at: "updated_at",
            }),
        },
    };
    const mockFactory: jest.Mock<Shopify> = jest.fn().mockReturnValue(shop) as jest.Mock<Shopify>;

    const scriptTags: ICreateScriptTag[] = [
        {
            display_scope: "all",
            event: "onload",
            src: "https://example.com/1",
        },
    ];

    const result = await handlerAsync(
        event,
        mockFactory,
        scriptTags,
    );

    expect(result).toBeTruthy();
    expect(shop.scriptTag.list).toBeCalled();
    expect(shop.scriptTag.delete.mock.calls.length).toBe(1);
    expect(shop.scriptTag.delete).toBeCalledWith(2);
});

test("Updates existing script tags", async () => {
    const event: SNSEvent = mockSnsEvent();

    const shop = {
        scriptTag: {
            list: jest.fn().mockName("scriptTag.list").mockReturnValue([
                {
                    created_at: "created_at",
                    display_scope: "all",
                    event: "onload",
                    id: 1,
                    src: "https://example.com/1",
                    updated_at: "updated_at",
                },
            ]),
            update: jest.fn().mockName("scriptTag.update").mockReturnValue({
                created_at: "created_at",
                display_scope: "all",
                event: "onload",
                id: 1,
                src: "https://example.com/1",
                updated_at: "updated_at",
            }),
        },
    };
    const mockFactory: jest.Mock<Shopify> = jest.fn().mockReturnValue(shop) as jest.Mock<Shopify>;

    const scriptTags: ICreateScriptTag[] = [
        {
            display_scope: "online_store",
            event: "onload",
            src: "https://example.com/1",
        },
    ];

    const result = await handlerAsync(
        event,
        mockFactory,
        scriptTags,
    );

    expect(result).toBeTruthy();
    expect(shop.scriptTag.list).toBeCalled();
    expect(shop.scriptTag.update.mock.calls.length).toBe(1);
    expect(shop.scriptTag.update).toBeCalledWith(1, {
        display_scope: "online_store",
        event: "onload",
        src: "https://example.com/1",
    });
});
