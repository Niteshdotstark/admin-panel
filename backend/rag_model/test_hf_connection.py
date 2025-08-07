import os
from huggingface_hub import InferenceClient
import logging
import requests
import traceback
import json # Import for JSON operations

# Set logging level to DEBUG for more detailed output
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logging.getLogger("huggingface_hub").setLevel(logging.DEBUG)
logging.getLogger("urllib3").setLevel(logging.DEBUG)

# Use the same method to get the token as your main script
HF_API_TOKEN_TEST = os.getenv("HF_API_TOKEN", "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")

if not HF_API_TOKEN_TEST:
    print("Error: HF_API_TOKEN not set. Please set it as an environment variable or hardcode in the script.")
    exit()

print(f"Using HF_API_TOKEN (first 5 chars): {HF_API_TOKEN_TEST[:5]}...")

# --- Initialize client ---
# The InferenceClient's token is used implicitly by client.post()
client = InferenceClient(token=HF_API_TOKEN_TEST)

# Test with your intended LLM model
LLM_MODEL_TO_TEST = "mistralai/Mixtral-8x7B-Instruct-v0.1"
# For a publicly available model that explicitly supports text-generation, you could use:
# LLM_MODEL_TO_TEST = "HuggingFaceH4/zephyr-7b-beta"
# If you switch back to `zephyr-7b-beta`, you could use client.text_generation directly,
# as it supports that task. But for Mixtral, we need client.post with the 'conversational' structure.


# --- Attempting to query the model using client.post() for 'conversational' task ---
try:
    print(f"Attempting to query '{LLM_MODEL_TO_TEST}' for conversational task via InferenceClient.post()...")

    # The Inference API expects a specific JSON structure for conversational models
    # This maps to the `inputs` dictionary we had before
    payload = {
        "inputs": {
            "text": "Tell me about the history of AI in two sentences.",
            "generated_responses": [],
            "past_user_inputs": []
        }
    }
    
    # You also need to specify the task for client.post
    # The URL for the inference API is constructed internally by client.post
    # The API endpoint for conversational models is often /models/{model_id}
    # and the task is implicitly handled by the payload structure or inferred by the model.
    
    # Let's try it with the common /models/{model_id} endpoint and a direct post,
    # as the 'conversational' task implies a specific endpoint behavior.
    
    # NOTE: The Hugging Face InferenceClient's `post` method is lower-level.
    # It sends a request to a given model's Inference API endpoint.
    # The 'conversational' task structure means the API expects it.

    # The `task` parameter in client.post() is often used for routing to the correct backend.
    response = client.post(
        json=payload,
        model=LLM_MODEL_TO_TEST,
        task="conversational" # Explicitly specify the task to the client.post method
    )

    # The response from client.post is a dictionary or similar structure,
    # and its content depends on the specific API response.
    # For conversational, it usually has 'generated_text' and 'conversation' keys.
    response_data = json.loads(response.decode('utf-8')) # Decode bytes response to string, then parse JSON

    print(f"\nSuccessfully connected to Hugging Face Inference API with {LLM_MODEL_TO_TEST}!")
    print(f"Generated text: {response_data.get('generated_text')}")
    print(f"Conversation history: {response_data.get('conversation')}")


except Exception as e:
    print(f"\nERROR: Failed to connect to Hugging Face Inference API with model {LLM_MODEL_TO_TEST}.")
    print(f"Details: {e}")
    print("\nFull Traceback:")
    traceback.print_exc()
    print("\nPossible causes:")
    print("- Invalid or expired HF_API_TOKEN. Check https://huggingface.co/settings/tokens")
    print("- Network issues (firewall, proxy, no internet to api-inference.huggingface.co).")
    print("- Outdated `huggingface_hub` library (try `pip install --upgrade huggingface_hub`)")
    print(f"- Model '{LLM_MODEL_TO_TEST}' might be gated and requires explicit access acceptance on its Hugging Face page (https://huggingface.co/{LLM_MODEL_TO_TEST}).")
    print("  Make sure your token is linked to an account that has accepted the terms for this specific model.")