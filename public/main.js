const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const form = document.getElementById("uploadForm");
const uploadButtonArea = document.getElementById("uploadButtonArea");

const input = document.getElementById("codeInput");
const downloadButton = document.getElementById("downloadBtn");

// uploadエリアクリックでfile選択
uploadArea.addEventListener("click", () => {
    fileInput.click();
});

// ファイル選択時にファイル名表示
fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
        uploadArea.querySelector("h3").textContent = fileInput.files[0].name;
        uploadButtonArea.classList.remove("hidden");
    } else {
        uploadButtonArea.classList.add("hidden");
    }
});

// フォーム送信
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    const res = await fetch("upload", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    if (data && data.code) {
        alert("共有コード: " + data.code);
    } else {
        alert("アップロード失敗");
    }
});

/* ダウンロード */

// 数字のみ入力許可
input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, ""); // 数字以外削除
});

downloadButton.addEventListener("click", () => {
    const code = input.value;

    // バリデーション：6桁の数字
    if (!/^\d{6}$/.test(code)) {
        alert("6桁の数字を入力してください");
        return;
    }

    // GETリクエストを送信
    const url = `/download?code=${code}`;
    window.location.href = url;
})

// document.getElementById("downloadBtn").addEventListener("click", async () => {
//       try {
//         const res = await fetch("/download");

//         if (!res.ok) {
//           alert("ダウンロードに失敗しました");
//           return;
//         }

//         // レスポンスをBlobとして受け取る
//         const blob = await res.blob();

//         // Blobから一時URLを作成
//         const url = window.URL.createObjectURL(blob);

//         // ⬇️ 自動的にダウンロードさせる
//         const a = document.createElement("a");
//         a.href = url;
//         a.download = "apple.png"; // ダウンロード時のファイル名
//         document.body.appendChild(a);
//         a.click();

//         // 後片付け
//         a.remove();
//         window.URL.revokeObjectURL(url);
//       } catch (err) {
//         console.error(err);
//       }
//     });

// document.getElementById("recv").addEventListener("submit", (e) => {
//     e.preventDefault();
//     const code = new FormData(e.currentTarget).get("code");
//     // ブラウザにダウンロードさせる
//     location.href = `/download?code=${encodeURIComponent(code)}`;
//   });