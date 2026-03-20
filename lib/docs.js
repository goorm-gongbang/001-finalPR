import fs from "fs";
import path from "path";

export async function getDocContent(slugArray) {
    const match = slugArray.join("/");
    const filePath = path.join(process.cwd(), "docs/content", match + ".md");

    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, "utf-8");
        }
    } catch (e) {
        // fall through to default message
    }

    return `해당 문서(경로: ${match})를 찾을 수 없습니다.`;
}
