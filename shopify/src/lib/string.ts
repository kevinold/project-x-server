export function getRandomString(len: number = 32): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWYZYabcdefghijklmnopqrstuvwxyz0123456789";

    let random = "";
    for (let i = 0; i < len; i++) {
        random = random + alphabet[Math.round(Math.random() * alphabet.length)];
    }

    return random;
}

export function snakeCase(str: string): string {
    return str.split("_")
        .map((v, i) => {
            if (i === 0 || v.length < 2) {
                return v.toLowerCase();
            }
            return `${v.substring(0, 1).toUpperCase()}${v.substring(1).toLowerCase()}`;
        })
        .join("");
}
