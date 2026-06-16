/**
 * Update job 30003 with the completed Descript download URL
 * and reset the YouTube upload state for a fresh attempt
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("No DATABASE_URL in env");
  process.exit(1);
}

const DOWNLOAD_URL = "https://production-273614-media-export.storage.googleapis.com/7135666d-676f-4be3-9f1c-b0bb3bbd2116/original.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=descript-api%40production-273614.iam.gserviceaccount.com%2F20260616%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260616T025031Z&X-Goog-Expires=86400&X-Goog-SignedHeaders=host&X-Goog-Signature=3419e51e916082b4f285e1f24dbb45821e7ef2da3312fcf61b4f951634c43e7beb5c13d54508f0ab0591d5f3ada0b05c377c904daf2397f5f030dee2be63e51d7fcaa2da31e11be185ba079b1e980628512e9b84257843bbcb13d32cad2da3ce3aa219e790e0ff37c653f0fc218d22bc938057dc66a7501bf335886e3fad65436bbb5531d46001f8382798d3c023514d9202a9dd54c606c90af8a6c4388a686722f25cd0ab652816d6200d4b513c5817b7b5fcd9db8838e58b2533bc033c90ebac3caef402c158464994e94808a7e005be6223024e8cc0c6cc57cc8d29f91888b72e720079f1512f8d140a4c47da23d8af2713f7875a06be1e66cd880271832b";

const conn = await mysql.createConnection(DATABASE_URL);

try {
  const [result] = await conn.execute(
    `UPDATE video_jobs 
     SET 
       vj_descript_download_url = ?,
       vj_yt_upload_uri = NULL,
       vj_yt_upload_offset = 0,
       vj_error_message = NULL,
       video_job_status = 'uploading'
     WHERE id = 30003`,
    [DOWNLOAD_URL]
  );
  console.log("Updated rows:", result.affectedRows);
  
  // Verify
  const [rows] = await conn.execute(
    `SELECT id, video_job_status, LEFT(vj_descript_download_url, 80) as url_preview, vj_yt_upload_uri, vj_error_message FROM video_jobs WHERE id = 30003`
  );
  console.log("Job 30003 state:", rows[0]);
} finally {
  await conn.end();
}
