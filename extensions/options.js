const api = typeof browser !== "undefined" ? browser : chrome;

const apiKeyInput = document.getElementById("apiKey");
const status = document.getElementById("status");

api.storage.sync.get("apiKey").then(data => {
  if (data.apiKey) apiKeyInput.value = data.apiKey;
});

function setStatus(msg, type = "") {
  status.textContent = msg;
  status.className = "status " + type;
}

document.getElementById("save").onclick = async () => {
  const value = apiKeyInput.value.trim();

  if (!value) {
    setStatus("Please enter an API key", "error");
    return;
  }

  await api.storage.sync.set({ apiKey: value });
  setStatus("Saved successfully", "success");
};

document.getElementById("test").onclick = async () => {
  const value = apiKeyInput.value.trim();

  if (!value) {
    setStatus("Enter API key first", "error");
    return;
  }

  setStatus("Testing...");

  try {
    const res = await fetch("https://api.unfolded.tools/v1/icons/apps", {
      headers: { "X-API-Key": value }
    });

    if (!res.ok) throw new Error();

    setStatus("API key is valid", "success");
  } catch {
    setStatus("Invalid API key", "error");
  }
};
