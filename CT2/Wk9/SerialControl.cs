using UnityEngine;
using System.IO.Ports;
using System.Threading;
using System;

public class SerialControl : MonoBehaviour
{
    [Header("串口设置")]
    public string portName = "COM3"; // 请在 Unity Inspector 中改成你实际的端口号
    public int baudRate = 115200;    // 已经修改为与 ESP32 一致的 115200

    [Header("移动范围设置 (Unity中的坐标)")]
    public float xMin = -5f; // X轴最左边界
    public float xMax = 5f;  // X轴最右边界
    public float yMin = -5f; // Y轴最下边界
    public float yMax = 5f;  // Y轴最上边界

    private SerialPort serialPort;
    private Thread serialThread;
    private bool isRunning = true;

    // 存储解析和映射后的目标坐标
    private Vector3 targetPosition;
    
    // 存储按钮状态
    private bool isButtonPressed = false;

    void Start()
    {
        // 1. 初始化串口
        serialPort = new SerialPort(portName, baudRate);
        serialPort.ReadTimeout = 50; 

        try
        {
            serialPort.Open();
            Debug.Log("串口开启成功: " + portName);

            // 2. 开启后台线程读取数据
            serialThread = new Thread(ReadSerialData);
            serialThread.IsBackground = true;
            serialThread.Start();
        }
        catch (Exception e)
        {
            Debug.LogError("无法打开串口，请检查端口号是否被 Arduino IDE 的串口监视器占用: " + e.Message);
        }
    }

    void Update()
    {
        // 3. 在主线程中平滑移动 Cube
        // 使用 Vector3.Lerp 让移动产生“拖尾/平滑”的缓冲效果
        transform.position = Vector3.Lerp(transform.position, targetPosition, Time.deltaTime * 10f);

        // 4. 附加功能：按钮交互
        // 如果按下按钮，让 Cube 变成红色，松开恢复原本颜色（假设Cube有默认材质）
        if (isButtonPressed)
        {
            GetComponent<Renderer>().material.color = Color.red;
        }
        else
        {
            GetComponent<Renderer>().material.color = Color.white;
        }
    }

    // 后台线程方法：负责专心接收和解析数据
    void ReadSerialData()
    {
        while (isRunning && serialPort != null && serialPort.IsOpen)
        {
            try
            {
                // 读取单片机发来的数据，例如: "2048,1024,1"
                string data = serialPort.ReadLine(); 
                
                if (!string.IsNullOrEmpty(data))
                {
                    string[] values = data.Split(',');

                    if (values.Length >= 3)
                    {
                        // 解析原始数据 (ESP32的模拟读取范围是 0 ~ 4095)
                        float rawX = float.Parse(values[0]);
                        float rawY = float.Parse(values[1]);
                        int btnValue = int.Parse(values[2]);

                        // 【核心改动：数据映射 Mapping】
                        // 将 0~4095 的摇杆数据转换为 -5 到 5 的 Unity 世界坐标
                        // 比如 rawX 是 2048 (中间值) 时，mappedX 就会是 0
                        float mappedX = Mathf.Lerp(xMin, xMax, rawX / 4095f);
                        float mappedY = Mathf.Lerp(yMin, yMax, rawY / 4095f);

                        // 更新目标位置 (这里假设控制 X 和 Y 轴，Z 轴保持为 0)
                        targetPosition = new Vector3(mappedX, mappedY, 0f);

                        // 识别按钮状态：INPUT_PULLUP 模式下，按下是 0，没按是 1
                        isButtonPressed = (btnValue == 0);
                    }
                }
            }
            catch (TimeoutException) { /* 超时忽略 */ }
            catch (Exception e) { Debug.LogWarning("数据解析错误: " + e.Message); }
        }
    }

    void OnDestroy()
    {
        isRunning = false;
        
        if (serialThread != null && serialThread.IsAlive)
        {
            serialThread.Join(100); 
        }
        
        if (serialPort != null && serialPort.IsOpen)
        {
            serialPort.Close();
            Debug.Log("串口已关闭");
        }
    }
}