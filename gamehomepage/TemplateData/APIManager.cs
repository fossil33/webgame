
using Newtonsoft.Json;
using System;
using System.Collections;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

public class APIManager : MonoBehaviour
{
#if UNITY_WEBGL
    [DllImport("__Internal")]
    private static extern void MySignalReady();
#endif

    public static APIManager Instance { get; private set; }
    public PlayerDataAPI PlayerData;
    public MarketAPI Market;
    public InventoryAPI Inventory;
    public QuestAPI Quest;
    public DialogueAPI Dialogue;
    public LoginData loginData;



    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
            return;
        }

    }

    public void Start()
    {
#if UNITY_WEBGL
        //MySignalReady();
        //Debug.Log("Unity -> 웹: 준비 완료 신호 보냄");
#endif


#if UNITY_EDITOR
        LoginData testData = new LoginData { user_id = "editor_user_id2", nickname = "에디터_테스터" };
        Debug.Log("에디터로 실행");
        ReceiveLoginData(JsonConvert.SerializeObject(testData));
#endif


    }


    //로그인 데이터 받기
    public void ReceiveLoginData(string loginJson)
    {
        Debug.Log("웹으로부터 로그인 데이터 수신: " + loginJson);

        //JSON 문자열을 파싱
        loginData = JsonConvert.DeserializeObject<LoginData>(loginJson);

        PlayerData = new PlayerDataAPI(this);
        Market = new MarketAPI(this, loginData.user_id);
        Inventory = new InventoryAPI(this, loginData.user_id);
        Quest = new QuestAPI(this, loginData.user_id);
        Dialogue = new DialogueAPI(this);

        PlayerData.RequestLoadPlayerData(loginData.user_id);
    }



    // 애플리케이션 종료 시 소켓 연결을 끊기
    private void OnApplicationQuit()
    {
        CancelInvoke("AutoSaveData");
    }


    public class LoginData
    {
        public string user_id;
        public string nickname;
    }




}