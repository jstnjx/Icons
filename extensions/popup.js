const api = typeof browser !== "undefined" ? browser : chrome;

const input = document.getElementById("apiKey");
const status = document.getElementById("status");

api.storage.sync.get("apiKey").then(data => {
  if (data.apiKey) input.value = data.apiKey;
});

document.getElementById("save").onclick = async () => {
  const value = input.value.trim();

  if (!value) {
    status.textContent = "Enter API key";
    return;
  }

  await api.storage.sync.set({ apiKey: value });
  status.textContent = "Saved";
};

document.getElementById("openSettings").onclick = () => {
  api.runtime.openOptionsPage();
};
