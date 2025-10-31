using Newtonsoft.Json;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using static APIManager;

public class PlayerDataAPI
{
    private MonoBehaviour coroutineRunner;
    private string userId;

    // 생성자를 통해 MonoBehaviour 인스턴스를 주입받습니다.
    public PlayerDataAPI(MonoBehaviour runner)
    {
        this.coroutineRunner = runner;
    }


    // 플레이어 데이터 요청
    IEnumerator RequestLoadPlayerDataCoroutine(string userId)
    {
        string url = $"{APIConstants.BASE_API_URL}/playerData/{userId}";
        using (UnityWebRequest webRequest = UnityWebRequest.Get(url))
        {
            yield return webRequest.SendWebRequest();

            if (webRequest.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    PlayerData data = JsonConvert.DeserializeObject<PlayerData>(webRequest.downloadHandler.text);
                    Debug.Log("플레이어 데이터 로드 성공: " + data.id);
                    DataManager.Instance.LoadPlayerData(data);


                    //LoadingScene.LoadScene("Main");
                }
                catch (JsonException ex)
                {
                    Debug.LogError("JSON 역직렬화 오류: " + ex.Message);
                }
            }
            else
            {
                Debug.LogError($"플레이어 데이터 로드 실패: {webRequest.error}");
            }
        }
    }

    //플레이어 데이터 저장
    IEnumerator SavePlayerDataCourotine(PlayerData data)
    {
        string json = JsonConvert.SerializeObject(data);

        string url = $"{APIConstants.BASE_API_URL}/playerData/{userId}";

        using (UnityWebRequest webRequest = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = Encoding.UTF8.GetBytes(json);
            webRequest.uploadHandler = new UploadHandlerRaw(bodyRaw);
            webRequest.downloadHandler = new DownloadHandlerBuffer();
            webRequest.SetRequestHeader("Content-Type", "application/json");

            yield return webRequest.SendWebRequest();

            if (webRequest.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"Client {userId} : 데이터 저장 완료");
            }
            else
            {
                Debug.LogError("데이터 저장 실패: " + webRequest.error);
            }
        }

    }


    public void RequestLoadPlayerData(string userId)
    {
        this.userId = userId;
        coroutineRunner.StartCoroutine(RequestLoadPlayerDataCoroutine(userId));
    }

    public void RequestSavePlayerData(PlayerData data)
    {
        coroutineRunner.StartCoroutine(SavePlayerDataCourotine(data));
    }



}
