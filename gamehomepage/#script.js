function callKoGPT() {
    const prompt = document.getElementById('prompt').value;
    const maxTokens = 32; // 변경 가능
    const temperature = 1.0; // 변경 가능
    const topP = 1.0; // 변경 가능
    const n = 3; // 변경 가능

    fetch('https://api.kakaobrain.com/v1/inference/kogpt/generation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'KakaoAK ${7b4c43469892854149d653f502531e2f}'
        },
        body: JSON.stringify({
            prompt: prompt,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP,
            n: n
        })
    })
    .then(response => response.json())
    .then(data => {
        const outputContainer = document.getElementById('output');
        outputContainer.innerHTML = '';
        for (let i = 0; i < data.generations.length; i++) {
            const text = data.generations[i].text;
            const textElement = document.createElement('p');
            textElement.textContent = text;
            outputContainer.appendChild(textElement);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        const outputContainer = document.getElementById('output');
        outputContainer.innerHTML = '<p>API 호출에 실패했습니다.</p>';
    });
}
