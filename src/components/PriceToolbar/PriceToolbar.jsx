import React from 'react'
import { Flex, Select, Typography } from "antd";
import SearchBar from "../SearchBar/SearchBar";
import "./PriceToolbar.css";

const { Text } = Typography;

const PriceToolbar = () => {
  return (
    <section className="price-toolbar">
      <div className="price-toolbar-container">

        <SearchBar />

        <Flex
          className="toolbar-filters"
          justify="space-between"
          align="center"
        >
          <Flex gap="middle">

            <Select
              placeholder="Category"
              style={{ width: 180 }}
            />

            <Select
              placeholder="Sort By"
              style={{ width: 180 }}
            />

          </Flex>

          <Text type="secondary">
            Last Updated: August 7, 2026
          </Text>

        </Flex>

      </div>
    </section>

  )
}

export default PriceToolbar
