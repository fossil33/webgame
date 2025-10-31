using Newtonsoft.Json;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Net;
using Unity.Services.Relay.Models;
using UnityEngine;
using UnityEngine.Networking;

public class InventoryAPI
{
    private MonoBehaviour coroutineRunner;
    private string userId;

    // 생성자를 통해 MonoBehaviour 인스턴스를 주입받습니다.
    public InventoryAPI(MonoBehaviour runner, string userId)
    {
        this.coroutineRunner = runner;
        this.userId = userId;
    }

    IEnumerator GetInventoryItem()
    {
        string url = $"{APIConstants.BASE_API_URL}/playerData/inventory/{userId}";

        using (UnityWebRequest webRequest = UnityWebRequest.Get(url))
        {
            yield return webRequest.SendWebRequest();
            if(webRequest.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string jsonResponse = webRequest.downloadHandler.text;
                    Debug.Log($"Inventory Data Received: {jsonResponse}");

                    InventoryResponse response = JsonConvert.DeserializeObject<InventoryResponse>(jsonResponse);

                    APIEvents.OnGetInventory?.Invoke(response);
                }catch(JsonException ex)
                {
                    Debug.Log("역직렬화 오류"  + ex.Message);
                }

            }
        }

    }

    IEnumerator SaveInventoryItem(SlotData slotData)
    {
        string url = $"{APIConstants.BASE_API_URL}/playerData/inventory/{userId}";

        string jsonData = JsonConvert.SerializeObject(slotData);
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonData);

        using (UnityWebRequest webRequest = new UnityWebRequest(url, "POST"))
        {
            webRequest.uploadHandler = new UploadHandlerRaw(bodyRaw);
            webRequest.downloadHandler = new DownloadHandlerBuffer();
            webRequest.SetRequestHeader("Content-Type", "application/json");

            yield return webRequest.SendWebRequest();

            if(webRequest.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"Error: {webRequest.error}");
            }
        }
    }

    public void RequestInventory()
    {
        coroutineRunner.StartCoroutine(GetInventoryItem());
    }

    public void RequestSaveInventory(SlotData slotData)
    {
        coroutineRunner.StartCoroutine(SaveInventoryItem(slotData));
    }

}

public class InventoryResponse{
    public SlotData[] inventory;
}

