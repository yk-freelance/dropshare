const uploadNormalView = `
<form id="uploadForm" method="post" enctype="multipart/form-data">
    <input type="file" id="fileInput" name="file" hidden required />
    <div class="upload-area" id="uploadArea">
        <div class="icon-circle">
            <span class="material-symbols-outlined">upload</span>
        </div>
        <h3>ファイルを選択</h3>
        <p>クリックしてファイルを選択</p>
    </div>
    <div class="upload-button-area hidden" id="uploadButtonArea">
        <button type="submit" class="btn-upload" id="btnUpload">アップロード</button>
    </div>
</form>
`

function uploadCompleteView(code){
    return `
    <div class="upload-complete-card">
        <div class="status-badge">
            <span class="material-symbols-outlined">check_circle</span>
            <span>アップロード完了</span>
        </div>
        <p class="status-label">共有コード</p>
        <div class="share-code-box">${code}</div>
        <p class="expire-message">1時間以内に受信してください。</p>
        <button class="btn-confirmed" id="btnConfirmed">確認しました</button>
    </div>
    `;
}

const receiveNormalView = `
<div class="receive-card">
    <div class="icon-circle-blue">
        <span class="material-symbols-outlined">download</span>
    </div>
    <div class="input-group">
        <label>共有コード</label>
        <input type="text" placeholder="8桁のコード" maxlength="8">
    </div>
    <button class="btn-receive">ファイルを受信</button>
</div>
`

const receiveCompleteView = `
    <div class="receive-complete-card">
        <h3>ファイルを受信しました。</h3>
        <p class="receive-complete-message">保存先のフォルダをご確認ください。</p>
        <button class="btn-receive-complete">受信完了</button>
    </div>
`

function render(uploaded, received, code){
    const uploadPanel = document.getElementById("uploadPanel");
    const receivePanel = document.getElementById("receivePanel");

    if(uploaded===false){
        uploadPanel.innerHTML = uploadNormalView;
    }
    else {
        uploadPanel.innerHTML = uploadCompleteView(code);
    }

    if(received===false){
        receivePanel.innerHTML = receiveNormalView;
    }
    else {
        receivePanel.innerHTML = receiveCompleteView;
    }

    attachEvents();
}

function attachEvents(){
    const uploadArea = document.getElementById("uploadArea");
    const fileInput = document.getElementById("fileInput");
    const uploadButtonArea = document.getElementById("uploadButtonArea");
    const form = document.getElementById("uploadForm");
    const confirmButton = document.getElementById("btnConfirmed");
    // uploadエリアクリックでfile選択
    if(uploadArea && fileInput){
        uploadArea.addEventListener("click", () => {
            fileInput.click();
        });
    }
    // ファイル選択時にファイル名表示
    if(fileInput && uploadArea && uploadButtonArea){
        fileInput.addEventListener("change", () => {
            if (fileInput.files.length > 0) {
                uploadArea.querySelector("h3").textContent = fileInput.files[0].name;
                uploadButtonArea.classList.remove("hidden");
            } else {
                uploadButtonArea.classList.add("hidden");
            }
        });
    }
    // フォーム送信
    if(form){
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(form); 
            const res = await fetch("upload", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data && data.code) {
                // alert("共有コード: " + data.code);
                render(true, false, data.code);
            } else {
                alert("アップロード失敗");
            }
        });
    }
    // 完了ボタン押下時
    if(confirmButton){
        confirmButton.addEventListener("click", () => {
            render(false, false);
        })
    }
}

render(false, false);
