using System;
using UnityEngine;
using UnityEngine.InputSystem.LowLevel;

public static class APIEvents
{

    //아이템 등록
    public static Action<ItemRegistResponse> OnItemRegister;

    //아이템 구매
    public static Action<BuyItemResponse> OnBuyItem;

    //아이템 취소
    public static Action<CancelRegistResponse> OnCancelItem;

    //아이템 판매 목록 가져오기
    public static Action<IMarketItemResponse> OnGetSellingListSuccess;  //아이템 판매 목록 가져오기 성공 이벤트
    public static Action<IMarketItemResponse> OnGetMySellingListSuccess; //내 판매 목록 가져오기 성공 이벤트


    //인벤토리 목록 가져오기
    public static Action<InventoryResponse> OnGetInventory;

    //퀘스트 데이터 가져오기
    public static Action<QuestDefinition[], QuestStatus[]> OnGetQuestData;

    //대화 내용 가져오기
    public static Action<Dialogue[]> OnGetDialogue;
}
