package cn.ryan.wfmap;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        registerPlugin(ExhibitionPhotosPlugin.class);
        super.onCreate(state);
    }
}
