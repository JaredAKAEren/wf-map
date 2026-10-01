package cn.ryan.wfmap;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.graphics.Bitmap;
import android.net.Uri;
import android.util.Base64;
import android.util.Size;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 只保存原图 URI。缩略图仅在内存生成，原图始终属于系统相册。 */
@CapacitorPlugin(name = "ExhibitionPhotos")
public class ExhibitionPhotosPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PhotoDatabase store;
    private boolean pickerOpen;

    @Override
    public void load() {
        store = new PhotoDatabase(getContext());
    }

    @PluginMethod
    public void pick(PluginCall call) {
        if (pickerOpen) { call.reject("照片选择器已打开"); return; }
        pickerOpen = true;
        try {
            Intent intent = new ActivityResultContracts.PickMultipleVisualMedia(50).createIntent(
                getContext(), new PickVisualMediaRequest.Builder()
                    .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE).build());
            intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
            startActivityForResult(call, intent, "picked");
        } catch (Exception error) {
            pickerOpen = false;
            call.reject("无法打开系统照片选择器", error);
        }
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        pickerOpen = false;
        if (call == null) return;
        Set<Uri> selected = new LinkedHashSet<>();
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK && data != null) {
            if (data.getData() != null) selected.add(data.getData());
            if (data.getClipData() != null) {
                for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                    selected.add(data.getClipData().getItemAt(i).getUri());
                }
            }
        }
        JSArray uris = new JSArray();
        int failed = 0;
        for (Uri uri : selected) {
            try {
                if (!"content".equals(uri.getScheme())) throw new SecurityException("非媒体引用");
                getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (!canRead(uri)) throw new SecurityException("未获得持久读取权限");
                uris.put(uri.toString());
            } catch (Exception error) { failed++; }
        }
        JSObject response = new JSObject();
        response.put("uris", uris);
        response.put("failed", failed);
        call.resolve(response);
    }

    private boolean canRead(Uri uri) {
        for (UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (permission.isReadPermission() && permission.getUri().equals(uri)) return true;
        }
        return false;
    }

    private String owner(String uri) {
        try (Cursor cursor = store.getReadableDatabase().query("photos", new String[]{"booth"},
                "uri = ?", new String[]{uri}, null, null, null)) {
            return cursor.moveToFirst() ? cursor.getString(0) : null;
        }
    }

    @PluginMethod
    public void list(PluginCall call) {
        String booth = call.getString("boothId");
        if (booth == null) { call.reject("缺少展位"); return; }
        worker.execute(() -> {
            try (Cursor cursor = store.getReadableDatabase().query("photos", null,
                    "booth = ?", new String[]{booth}, null, null, "created DESC")) {
                JSArray items = new JSArray();
                while (cursor.moveToNext()) {
                    JSObject item = new JSObject();
                    item.put("uri", cursor.getString(cursor.getColumnIndexOrThrow("uri")));
                    item.put("boothId", booth);
                    item.put("createdAt", cursor.getLong(cursor.getColumnIndexOrThrow("created")));
                    items.put(item);
                }
                JSObject result = new JSObject(); result.put("photos", items); call.resolve(result);
            } catch (Exception error) { call.reject("无法读取照片记录", error); }
        });
    }

    @PluginMethod
    public void listBooths(PluginCall call) {
        worker.execute(() -> {
            try (Cursor cursor = store.getReadableDatabase().query(true, "photos",
                    new String[]{"booth"}, null, null, null, null, "booth", null)) {
                JSArray ids = new JSArray();
                while (cursor.moveToNext()) {
                    ids.put(cursor.getString(0));
                }
                JSObject result = new JSObject();
                result.put("boothIds", ids);
                call.resolve(result);
            } catch (Exception error) { call.reject("无法读取贴图展位", error); }
        });
    }

    @PluginMethod
    public void assign(PluginCall call) {
        String uri = call.getString("uri"); String booth = call.getString("boothId");
        if (uri == null || booth == null || !booth.startsWith("wf2026/")) { call.reject("无效的展位或照片"); return; }
        worker.execute(() -> {
            try {
                if (!canRead(Uri.parse(uri))) throw new SecurityException("照片需要重新授权");
                String previous = owner(uri);
                if (previous != null && !previous.equals(booth) && !Boolean.TRUE.equals(call.getBoolean("replace"))) {
                    JSObject result = new JSObject(); result.put("conflict", previous); call.resolve(result); return;
                }
                if (!booth.equals(previous)) {
                    ContentValues values = new ContentValues();
                    values.put("uri", uri); values.put("booth", booth); values.put("created", System.currentTimeMillis());
                    long saved = store.getWritableDatabase().insertWithOnConflict("photos", null, values, SQLiteDatabase.CONFLICT_REPLACE);
                    if (saved == -1) throw new IllegalStateException("照片记录写入失败");
                }
                call.resolve(new JSObject());
            } catch (Exception error) { call.reject("关联未保存", error); }
        });
    }

    @PluginMethod
    public void thumbnail(PluginCall call) {
        String value = call.getString("uri");
        if (value == null) { call.reject("缺少照片"); return; }
        worker.execute(() -> {
            try {
                Uri uri = Uri.parse(value);
                if (owner(value) == null || !canRead(uri)) throw new SecurityException("照片不可访问");
                Bitmap bitmap = getContext().getContentResolver().loadThumbnail(uri, new Size(640, 640), null);
                try (ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, bytes);
                    JSObject response = new JSObject();
                    response.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                    call.resolve(response);
                } finally { bitmap.recycle(); }
            } catch (Exception error) { call.reject("原照片已删除或读取权限失效", error); }
        });
    }

    @PluginMethod
    public void open(PluginCall call) {
        String value = call.getString("uri");
        worker.execute(() -> {
            try {
                if (value == null || owner(value) == null || !canRead(Uri.parse(value))) throw new SecurityException("照片不可访问");
                Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(value), "image/*")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().runOnUiThread(() -> {
                    try { getActivity().startActivity(intent); call.resolve(); }
                    catch (Exception error) { call.reject("无法打开照片查看器", error); }
                });
            } catch (Exception error) { call.reject("照片不可访问", error); }
        });
    }

    private void release(String value) {
        try { getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(value), Intent.FLAG_GRANT_READ_URI_PERMISSION); }
        catch (SecurityException ignored) { /* 原授权可能已被撤销。 */ }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) { call.reject("缺少照片"); return; }
        worker.execute(() -> {
            try {
                store.getWritableDatabase().delete("photos", "uri = ?", new String[]{uri});
                release(uri); call.resolve();
            } catch (Exception error) { call.reject("无法解除关联", error); }
        });
    }

    @PluginMethod
    public void releaseUnlinked(PluginCall call) {
        JSArray uris = call.getArray("uris", new JSArray());
        worker.execute(() -> {
            try {
                for (int i = 0; i < uris.length(); i++) {
                    String uri = uris.getString(i);
                    if (owner(uri) == null) release(uri);
                }
                call.resolve();
            } catch (Exception error) { call.reject("无法释放照片授权", error); }
        });
    }

    @Override
    protected void handleOnDestroy() {
        worker.execute(() -> store.close());
        worker.shutdown();
    }

    static class PhotoDatabase extends SQLiteOpenHelper {
        PhotoDatabase(Context context) { super(context, "wf-photos.db", null, 1); }
        @Override public void onCreate(SQLiteDatabase database) {
            database.execSQL("CREATE TABLE photos (uri TEXT PRIMARY KEY, booth TEXT NOT NULL, created INTEGER NOT NULL)");
            database.execSQL("CREATE INDEX photos_booth ON photos(booth)");
        }
        @Override public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {
            throw new IllegalStateException("照片数据库升级必须提供保留记录的迁移");
        }
    }
}
