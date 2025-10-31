using Newtonsoft.Json;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using Unity.VisualScripting;
using UnityEngine;
using UnityEngine.Networking;

public class QuestAPI
{
    private MonoBehaviour coroutineRunner;
    private string userId;

    // 생성자를 통해 MonoBehaviour 인스턴스를 주입받습니다.
    public QuestAPI(MonoBehaviour runner, string userId)
    {
        coroutineRunner = runner;
        this.userId = userId;
    }

    IEnumerator GetQuestData()
    {
        string url = $"{APIConstants.BASE_API_URL}/quest/{userId}";

        using (UnityWebRequest webRequest = UnityWebRequest.Get(url))
        {
            yield return webRequest.SendWebRequest();
            Debug.Log("퀘스트 가져오기 시도");
            if (webRequest.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    QuestDataList response = JsonConvert.DeserializeObject<QuestDataList>(webRequest.downloadHandler.text);
                    QuestDefinition[] questDataArray = response.questData;
                    QuestStatus[] questStatusesArray = response.questStatuses;

                    APIEvents.OnGetQuestData?.Invoke(questDataArray, questStatusesArray);
                }
                catch (JsonException ex)
                {
                    Debug.LogError("역직렬화 오류"+ ex.Message);
                }

            }
            else
            {
                Debug.LogError("퀘스트 가져오기 실패" + webRequest.error);
            }
        }
    }

    IEnumerator SaveQuestStatus(QuestStatus status)
    {
        string url = $"{APIConstants.BASE_API_URL}/quest/{userId}";
        string json = JsonConvert.SerializeObject(status);

        using (UnityWebRequest  webRequest = new UnityWebRequest(url, "POST")) 
        {
            byte[] bodyRaw = Encoding.UTF8.GetBytes(json);
            webRequest.uploadHandler = new UploadHandlerRaw(bodyRaw);
            webRequest.downloadHandler = new DownloadHandlerBuffer();
            webRequest.SetRequestHeader("Content-Type", "application/json");

            yield return webRequest.SendWebRequest();

            if(webRequest.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("퀘스트 저장 성공");
            }
            else
            {
                Debug.LogError("퀘스트 저장 실패");
            }
        
        }
    }


    public void RequestGetQuestData()
    {
        coroutineRunner.StartCoroutine(GetQuestData());
    }


    public void RequestSaveQuestStatus(QuestStatus status)
    {
        coroutineRunner.StartCoroutine(SaveQuestStatus(status));
    }
}

[System.Serializable]
public class QuestDataList
{
    public QuestDefinition[] questData;
    public QuestStatus[] questStatuses;
}
