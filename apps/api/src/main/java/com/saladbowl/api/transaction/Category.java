package com.saladbowl.api.transaction;

/** 화면에 보이는 카테고리. 스펙 9.1의 그룹 카테고리 매핑을 붙일 때 이 값이 바뀐다. */
public record Category(String major, String minor) {
}
