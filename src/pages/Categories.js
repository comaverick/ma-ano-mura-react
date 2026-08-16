import React, { useState } from 'react'
import { Button, Space, Typography } from 'antd'
const { Title } = Typography;


const Categories = () => {

  const [writer, setWriter] = useState(null);

  async function connectArduino() {
    const selectedPort = await navigator.serial.requestPort();

    await selectedPort.open({
      baudRate: 9600,
    });

    const writer = selectedPort.writable.getWriter();
    setWriter(writer);
  }

  async function turnOn() {
    if (!writer) return;

    await writer.write(new TextEncoder().encode("1"));
  }

  async function turnOff() {
    if (!writer) return;

    await writer.write(new TextEncoder().encode("0"));
  }

  return (
     <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <Title level={2}>Arduino LED Control</Title>

      <Button
        type="primary"
        onClick={connectArduino}
        style={{ marginBottom: 30 }}
      >
        Connect Arduino
      </Button>

      <Space size="large">
        <Button
          type="primary"
          onClick={turnOn}
          style={{
            backgroundColor: "#16a34a",
            borderColor: "#16a34a",
            width: 120,
            height: 50,
          }}
        >
          ON
        </Button>

        <Button
          type="primary"
          onClick={turnOff}
          style={{
            backgroundColor: "#dc2626",
            borderColor: "#dc2626",
            width: 120,
            height: 50,
          }}
        >
          OFF
        </Button>
      </Space>
    </div>
  )
}

export default Categories
