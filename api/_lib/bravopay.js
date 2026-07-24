const API = "https://bravopay.club/api/v1";

export async function bravopay(endpoint, options = {}) {

    const response = await fetch(API + endpoint, {
        ...options,
        headers: {
            Authorization: `Bearer ${process.env.BRAVOPAY_API_KEY}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const json = await response.json();

    if (!response.ok) {
        throw json;
    }

    return json;
}
