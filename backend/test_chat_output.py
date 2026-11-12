from agent.output import public_answer


def test_public_answer():
    answer = "สวัสดีค่ะ **Vera** พร้อมช่วยค่ะ"
    cases = [
        (answer, answer),
        ("<think>private\nplanning</think>\n" + answer, answer),
        ("private planning</think>\n" + answer, answer),
        ("<THINK>private</THINK>" + answer, answer),
        ("<think>unfinished private planning", ""),
        (answer + "<think>unfinished", answer),
        ("<think>one</think>" + answer + "<think>two</think>", answer),
        ([{"type": "reasoning", "text": "private"},
          {"type": "text", "text": answer}], answer),
        (["<think>private", "</think>", answer], answer),
        ([], ""),
    ]
    for content, expected in cases:
        assert public_answer(content) == expected


if __name__ == "__main__":
    test_public_answer()
    print("Chat output regression checks passed (10 cases)")
