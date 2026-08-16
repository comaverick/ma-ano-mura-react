import React from 'react'
import { SearchOutlined } from '@ant-design/icons'
import { Input, Button } from 'antd'
import './SearchBar.css'
const { Search } = Input;

const SearchBar = () => {
  return (

    <Search 
    className='search-input' 
    prefix={<SearchOutlined/>} 
    placeholder="Search ingredients or recipes... eg. Liempo, Sinigang" 
    enterButton={
        <Button className='search-button' size='middle' variant='solid'>Search</Button>
    }
    />
  )
}

export default SearchBar
